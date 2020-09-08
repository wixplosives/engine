import { promisify } from 'util';
import express from 'express';
import rimrafCb from 'rimraf';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import fs from '@file-services/node';

import { TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';
import performance from '@wixc3/cross-performance';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import {
    createConfigMiddleware,
    createLiveConfigsMiddleware,
    createCommunicationMiddleware,
    ensureTopLevelConfigMiddleware,
    OverrideConfig,
} from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { ForkedProcess } from './forked-process';
import { NodeEnvironmentsManager, LaunchEnvironmentMode } from './node-environments-manager';
import { createIPC } from './process-communication';
import type {
    EngineConfig,
    IConfigDefinition,
    IEnvironment,
    IFeatureDefinition,
    IFeatureTarget,
    IFeatureMessagePayload,
    TopLevelConfigProvider,
} from './types';
import { resolvePackages } from './utils/resolve-packages';
import generateFeature, { pathToFeaturesDirectory } from './feature-generator';
import { createFeaturesEngineRouter, generateConfigName } from './engine-router';
import { filterEnvironments } from './utils/environments';
import { launchHttpServer } from './launch-http-server';

const rimraf = promisify(rimrafCb);
const { basename, extname, join } = fs;

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
    singleFeature?: boolean;
    inspect?: boolean;
    port?: number;
    publicPath?: string;
    mode?: 'development' | 'production';
    title?: string;
    publicConfigsRoute?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    autoLaunch?: boolean;
}

export interface IBuildManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
}

export interface ICreateOptions {
    featureName?: string;
    templatesDir?: string;
    featuresDir?: string;
}

export interface IApplicationOptions {
    basePath?: string;
    outputPath?: string;
}

export class Application {
    public outputPath: string;
    protected basePath: string;

    constructor({ basePath = process.cwd(), outputPath = fs.join(basePath, 'dist') }: IApplicationOptions) {
        this.basePath = basePath;
        this.outputPath = outputPath;
    }

    public async clean() {
        await rimraf(this.outputPath);
        await rimraf(fs.join(this.basePath, 'npm'));
    }

    public async build({
        featureName,
        configName,
        publicPath,
        mode = 'production',
        singleFeature,
        title,
        publicConfigsRoute,
        overrideConfig,
    }: IRunOptions = {}): Promise<webpack.compilation.MultiStats> {
        const engineConfig = await this.getEngineConfig();
        if (engineConfig && engineConfig.require) {
            await this.importModules(engineConfig.require);
        }
        const { features, configurations } = this.analyzeFeatures();
        if (singleFeature && featureName) {
            this.filterByFeatureName(features, featureName);
        }
        const compiler = this.createCompiler({
            mode,
            features,
            featureName,
            configName,
            publicPath,
            title,
            configurations,
            staticBuild: true,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
        });

        const stats = await new Promise<webpack.compilation.MultiStats>((resolve, reject) =>
            compiler.run((e, s) => {
                if (e) {
                    reject(e);
                } else if (s.hasErrors()) {
                    reject(new Error(s.toString('errors-warnings')));
                } else {
                    resolve(s);
                }
            })
        );

        await this.writeManifest({
            features,
            featureName,
            configName,
        });

        return stats;
    }

    public async start({
        featureName,
        configName,
        runtimeOptions: defaultRuntimeOptions = {},
        inspect = false,
        port: httpServerPort,
        singleRun,
        overrideConfig = [],
        publicPath,
        mode = 'development',
        singleFeature,
        title,
        publicConfigsRoute = 'configs/',
        nodeEnvironmentsMode,
        autoLaunch = true,
    }: IRunOptions = {}) {
        const engineConfig = await this.getEngineConfig();
        if (engineConfig && engineConfig.require) {
            await this.importModules(engineConfig.require);
        }
        const disposables = new Set<() => unknown>();
        const { port, app, close, socketServer } = await launchHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort,
        });
        disposables.add(() => close());

        const { features, configurations, packages } = this.analyzeFeatures();
        if (singleFeature && featureName) {
            this.filterByFeatureName(features, featureName);
        }
        const compiler = this.createCompiler({
            mode,
            features,
            featureName,
            configName,
            publicPath,
            title,
            configurations,
            staticBuild: false,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
        });

        if (singleRun) {
            for (const childCompiler of compiler.compilers) {
                childCompiler.watch = function watch(_watchOptions, handler) {
                    childCompiler.run(handler);
                    return {
                        close(cb) {
                            if (cb) {
                                cb();
                            }
                        },
                        invalidate: () => undefined,
                    };
                };
            }
        }
        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            configurations,
            features,
            defaultRuntimeOptions,
            port,
            inspect,
            overrideConfig,
        });
        disposables.add(() => nodeEnvironmentManager.closeAll());

        const overrideConfigsMap = new Map<string, OverrideConfig>();
        if (engineConfig && engineConfig.serveStatic) {
            for (const { route, directoryPath } of engineConfig.serveStatic) {
                app.use(route, express.static(directoryPath));
            }
        }

        app.use(`/${publicConfigsRoute}`, [
            ensureTopLevelConfigMiddleware,
            createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
            createLiveConfigsMiddleware(configurations, this.basePath, overrideConfigsMap),
            createConfigMiddleware(overrideConfig),
        ]);

        for (const childCompiler of compiler.compilers) {
            const devMiddleware = webpackDevMiddleware(childCompiler, {
                publicPath: '/',
                logLevel: 'silent',
            });
            disposables.add(() => new Promise((res) => devMiddleware.close(res)));
            app.use(devMiddleware);
        }

        await new Promise((resolve) => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        const mainUrl = `http://localhost:${port}/`;
        console.log(`Listening:`);
        console.log('Dashboard URL: ', mainUrl);
        if (featureName) {
            console.log('Main application URL: ', `${mainUrl}main.html`);
        }

        const featureEnvDefinitions = this.getFeatureEnvDefinitions(features, configurations);

        if (packages.length === 1) {
            // print links to features
            console.log('Available Configurations:');
            for (const { configurations, featureName } of Object.values(featureEnvDefinitions)) {
                for (const runningConfigName of configurations) {
                    console.log(`${mainUrl}main.html?feature=${featureName}&config=${runningConfigName}`);
                }
            }
        }

        app.use('/engine-feature', createFeaturesEngineRouter(overrideConfigsMap, nodeEnvironmentManager));

        app.get('/engine-state', (_req, res) => {
            res.json({
                result: 'success',
                data: {
                    features: featureEnvDefinitions,
                    featuresWithRunningNodeEnvs: nodeEnvironmentManager.getFeaturesWithRunningEnvironments(),
                },
            });
        });

        if (autoLaunch && featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                overrideConfigsMap,
                mode: nodeEnvironmentsMode,
            });
        }

        return {
            port,
            router: app,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.clear();
            },
            runFeature: async ({
                featureName,
                runtimeOptions = {},
                configName,
                overrideConfig,
            }: IRunFeatureOptions) => {
                if (overrideConfig) {
                    const generatedConfigName = generateConfigName(configName);
                    overrideConfigsMap.set(generatedConfigName, {
                        overrideConfig: Array.isArray(overrideConfig) ? overrideConfig : [],
                        configName,
                    });
                    configName = generatedConfigName;
                }
                // clearing because if running features one after the other on same engine, it is possible that some measuring were done on disposal of stuff, and the measures object will not be re-evaluated, so cleaning it
                performance.clearMeasures();
                performance.clearMarks();
                return nodeEnvironmentManager.runServerEnvironments({
                    featureName,
                    configName,
                    overrideConfigsMap,
                    runtimeOptions,
                    mode: nodeEnvironmentsMode,
                });
            },
            closeFeature: ({ featureName, configName }: IFeatureMessagePayload) => {
                if (configName) {
                    overrideConfigsMap.delete(configName);
                }
                performance.clearMeasures();
                performance.clearMarks();
                return nodeEnvironmentManager.closeEnvironment({
                    featureName,
                    configName,
                });
            },
            getMetrics: () => {
                return {
                    marks: performance.getEntriesByType('mark'),
                    measures: performance.getEntriesByType('measure'),
                };
            },
            nodeEnvironmentManager,
        };
    }

    public async run(runOptions: IRunOptions = {}) {
        const { features, defaultConfigName, defaultFeatureName } = (await fs.promises.readJsonFile(
            join(this.outputPath, 'manifest.json')
        )) as IBuildManifest;

        const {
            configName = defaultConfigName,
            featureName = defaultFeatureName,
            runtimeOptions: defaultRuntimeOptions,
            inspect,
            port: httpServerPort,
            overrideConfig: userConfig = [],
            publicPath,
            publicConfigsRoute,
            nodeEnvironmentsMode = 'new-server',
            autoLaunch = true,
        } = runOptions;
        const engineConfig = await this.getEngineConfig();

        const disposables = new Set<() => unknown>();
        const configurations = await this.readConfigs();

        const { port, close, socketServer, app } = await launchHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort,
        });
        const config: TopLevelConfig = [...(Array.isArray(userConfig) ? userConfig : [])];
        disposables.add(() => close());

        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            features: new Map(features),
            port,
            defaultRuntimeOptions,
            inspect,
            overrideConfig: config,
            configurations,
        });
        disposables.add(() => nodeEnvironmentManager.closeAll());

        if (engineConfig && engineConfig.serveStatic) {
            for (const { route, directoryPath } of engineConfig.serveStatic) {
                app.use(route, express.static(directoryPath));
            }
        }

        if (publicConfigsRoute) {
            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
                createConfigMiddleware(config),
            ]);
        }
        if (autoLaunch && featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                mode: nodeEnvironmentsMode,
            });
        }

        return {
            port,
            router: app,
            nodeEnvironmentManager,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.clear();
            },
        };
    }

    public async remote({ port: preferredPort }: IRunOptions = {}) {
        if (!process.send) {
            throw new Error('"remote" command can only be used in a forked process');
        }
        const engineConfig = await this.getEngineConfig();
        if (engineConfig && engineConfig.require) {
            await this.importModules(engineConfig.require);
        }
        const { socketServer, close, port } = await launchHttpServer({
            staticDirPath: this.outputPath,
            httpServerPort: preferredPort,
        });

        const parentProcess = new ForkedProcess(process);
        createIPC(parentProcess, socketServer, { port, onClose: close });

        parentProcess.postMessage({ id: 'initiated' });
    }

    public async create({ featureName, templatesDir, featuresDir }: ICreateOptions = {}) {
        if (!featureName) {
            throw new Error('Feature name is mandatory');
        }

        const config = await this.getEngineConfig();

        const targetPath = pathToFeaturesDirectory(fs, this.basePath, config?.featuresDirectory || featuresDir);
        const featureDirNameTemplate = config?.featureFolderNameTemplate;
        const userTemplatesDirPath = config?.featureTemplatesFolder || templatesDir;
        const templatesDirPath = userTemplatesDirPath
            ? fs.join(this.basePath, userTemplatesDirPath)
            : fs.join(__dirname, '../templates');

        generateFeature({
            fs,
            featureName,
            targetPath,
            templatesDirPath,
            featureDirNameTemplate,
        });
    }

    protected async getEngineConfig() {
        const engineConfigFilePath = await fs.promises.findClosestFile(this.basePath, ENGINE_CONFIG_FILE_NAME);
        if (engineConfigFilePath) {
            try {
                return (await import(engineConfigFilePath)) as EngineConfig;
            } catch (ex) {
                throw new Error(`failed evaluating config file: ${engineConfigFilePath}`);
            }
        }
        return undefined;
    }

    protected async importModules(requiredModules: string[]) {
        for (const requiredModule of requiredModules) {
            try {
                await import(require.resolve(requiredModule, { paths: [this.basePath] }));
            } catch (ex) {
                throw new Error(`failed requiring: ${requiredModule} ${(ex as Error)?.stack || String(ex)}`);
            }
        }
    }

    protected async readConfigs(): Promise<SetMultiMap<string, TopLevelConfig>> {
        const configurations = new SetMultiMap<string, TopLevelConfig>();
        const configsDirectoryPath = join(this.outputPath, 'configs');
        if (await fs.promises.exists(configsDirectoryPath)) {
            const folderEntities = await fs.promises.readdir(configsDirectoryPath, { withFileTypes: true });
            for (const entity of folderEntities) {
                if (entity.isDirectory()) {
                    const featureName = entity.name;
                    const featureConfigsDirectory = join(configsDirectoryPath, featureName);
                    const featureConfigsEntities = await fs.promises.readdir(featureConfigsDirectory, {
                        withFileTypes: true,
                    });
                    for (const possibleConfigFile of featureConfigsEntities) {
                        const fileExtention = extname(possibleConfigFile.name);
                        if (possibleConfigFile.isFile() && fileExtention === '.json') {
                            const configFileName = basename(possibleConfigFile.name, fileExtention);
                            const [configName] = configFileName.split('.');

                            const config = (await fs.promises.readJsonFile(
                                join(featureConfigsDirectory, possibleConfigFile.name)
                            )) as TopLevelConfig;

                            configurations.add(`${featureName}/${configName}`, config);
                        }
                    }
                }
            }
        }

        return configurations;
    }

    protected async writeManifest({
        features,
        featureName,
        configName,
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
    }) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()),
            defaultConfigName: configName,
            defaultFeatureName: featureName,
        };

        await fs.promises.ensureDirectory(this.outputPath);
        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    protected createCompiler({
        features,
        featureName,
        configName,
        publicPath,
        mode,
        title,
        configurations,
        staticBuild,
        publicConfigsRoute,
        overrideConfig,
        singleFeature,
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
        publicPath?: string;
        mode?: 'production' | 'development';
        title?: string;
        configurations: SetMultiMap<string, IConfigDefinition>;
        staticBuild: boolean;
        publicConfigsRoute?: string;
        overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
        singleFeature?: boolean;
    }) {
        const { basePath, outputPath } = this;
        const baseConfigPath = fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig: webpack.Configuration = typeof baseConfigPath === 'string' ? require(baseConfigPath) : {};

        const enviroments = new Set<IEnvironment>();
        for (const { exportedEnvs } of features.values()) {
            for (const exportedEnv of exportedEnvs) {
                if (exportedEnv.type !== 'node') {
                    enviroments.add(exportedEnv);
                }
            }
        }
        const webpackConfigs = createWebpackConfigs({
            baseConfig,
            context: basePath,
            mode,
            outputPath,
            enviroments: Array.from(enviroments),
            features,
            featureName,
            configName,
            publicPath,
            title,
            configurations,
            staticBuild,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
        });

        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return compiler;
    }

    protected analyzeFeatures() {
        const { basePath } = this;
        console.time(`Analyzing Features.`);
        const packages = resolvePackages(basePath);
        const featuresAndConfigs = loadFeaturesFromPackages(packages, fs);
        console.timeEnd('Analyzing Features.');
        return { ...featuresAndConfigs, packages };
    }

    protected getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>
    ) {
        const rootFeatures = Array.from(features.values()).filter(({ isRoot }) => isRoot);
        const configNames = Array.from(configurations.keys());
        const featureEnvDefinitions: Record<
            string,
            { configurations: string[]; hasServerEnvironments: boolean; featureName: string }
        > = {};

        for (const { scopedName } of rootFeatures) {
            const [rootFeatureName] = scopedName.split('/');
            featureEnvDefinitions[scopedName] = {
                configurations: configNames.filter((name) => name.includes(rootFeatureName)),
                hasServerEnvironments: filterEnvironments(scopedName, features, 'node').size > 0,
                featureName: scopedName,
            };
        }

        return featureEnvDefinitions;
    }

    protected filterByFeatureName(features: Map<string, IFeatureDefinition>, featureName: string) {
        const foundFeature = features.get(featureName);
        if (!foundFeature) {
            throw new Error(`cannot find feature: ${featureName}`);
        }
        const featuresToInclude = new Set([...foundFeature.dependencies, featureName]);
        for (const [foundFeatureName] of features) {
            if (!featuresToInclude.has(foundFeatureName)) {
                features.delete(foundFeatureName);
            }
        }
    }
}

const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target as string} using webpack...`);

function hookCompilerToConsole(compiler: webpack.MultiCompiler): void {
    compiler.hooks.run.tap('engine-scripts', bundleStartMessage);
    compiler.hooks.watchRun.tap('engine-scripts', bundleStartMessage);

    compiler.hooks.done.tap('engine-scripts stats printing', ({ stats }) => {
        for (const childStats of stats) {
            if (childStats.hasErrors() || childStats.hasWarnings()) {
                console.log(childStats.toString('errors-warnings'));
            }
        }
        console.log('Done bundling.');
    });
}
