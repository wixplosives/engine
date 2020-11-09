import { promisify } from 'util';
import express from 'express';
import rimrafCb from 'rimraf';
import webpack from 'webpack';
import fs from '@file-services/node';

import { TopLevelConfig, SetMultiMap, flattenTree } from '@wixc3/engine-core';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import {
    createConfigMiddleware,
    createCommunicationMiddleware,
    ensureTopLevelConfigMiddleware,
} from './config-middleware';
import {
    createWebpackConfig,
    createWebpackConfigForExteranlFeature,
    createWebpackConfigs,
} from './create-webpack-configs';
import { ForkedProcess } from './forked-process';
import { NodeEnvironmentsManager, LaunchEnvironmentMode } from './node-environments-manager';
import { createIPC } from './process-communication';
import type {
    EngineConfig,
    IConfigDefinition,
    IEnvironment,
    IFeatureDefinition,
    IFeatureTarget,
    IExternalFeatureDefinition,
    TopLevelConfigProvider,
    IExtenalFeatureDescriptor,
} from './types';
import { resolvePackages } from './utils/resolve-packages';
import { generateFeature, pathToFeaturesDirectory } from './feature-generator';
import { getEnvironmntsForFeature, getResolvedEnvironments } from './utils/environments';
import { launchHttpServer } from './launch-http-server';
import { getExternalFeatures } from './utils';
import { createExternalNodeEntrypoint } from './create-entrypoint';
import { EXTERNAL_FEATURES_BASE_URI } from './commons';

const rimraf = promisify(rimrafCb);
const { basename, extname, join } = fs;

const builtinTemplatesPath = fs.join(__dirname, '../templates');

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunApplicationOptions extends IFeatureTarget {
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

export interface IBuildCommandOptions extends IRunApplicationOptions {
    external?: boolean;
    staticBuild?: boolean;
    withExternalFeatures?: boolean;
}

export interface IRunCommandOptions extends IRunApplicationOptions {
    serveExternalFeaturesPath?: boolean;
    externalFeaturesPath?: string;
    externalFeatureDefinitions?: IExternalFeatureDefinition[];
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
    featureDiscoveryRoot?: string;
}

export interface ICompilerOptions {
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
    isExternal: boolean;
    externalFeatures: IExtenalFeatureDescriptor[];
    fetchFeatures?: boolean;
}

export class Application {
    public outputPath: string;
    protected basePath: string;
    protected featureDiscoveryRoot?: string;

    constructor({
        basePath = process.cwd(),
        outputPath = fs.join(basePath, 'dist'),
        featureDiscoveryRoot,
    }: IApplicationOptions) {
        this.basePath = basePath;
        this.outputPath = outputPath;
        this.featureDiscoveryRoot = featureDiscoveryRoot;
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
        external = false,
        staticBuild = true,
        withExternalFeatures,
    }: IBuildCommandOptions = {}): Promise<webpack.compilation.MultiStats> {
        const { require, externalFeatureDefinitions, externalFeaturesPath = join(this.basePath, 'node_modules') } =
            (await this.getEngineConfig()) ?? {};
        if (require) {
            await this.importModules(require);
        }

        if (external && !featureName) {
            throw new Error('You must specify a feature name when building a feature in external mode');
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
            staticBuild,
            publicConfigsRoute,
            overrideConfig,
            singleFeature,
            isExternal: external,
            externalFeatures:
                withExternalFeatures && externalFeatureDefinitions
                    ? getExternalFeatures(
                          externalFeatureDefinitions,
                          [...getExportedEnvironments(features)],
                          externalFeaturesPath
                      )
                    : [],
            fetchFeatures: !withExternalFeatures,
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

        if (external) {
            this.createNodeEntries(features, featureName!, singleFeature);
        }

        await this.writeManifest({
            features,
            featureName,
            configName,
        });

        return stats;
    }

    public async run(runOptions: IRunCommandOptions = {}) {
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
            externalFeaturesPath: providedExternalFeatuersPath,
            serveExternalFeaturesPath: providedServeExternalFeaturesPath,
            externalFeatureDefinitions: providedExternalFeaturesDefinitions = [],
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

        const {
            externalFeatureDefinitions = [],
            externalFeaturesPath: baseExternalFeaturesPath,
            serveExternalFeaturesPath = providedServeExternalFeaturesPath,
            serveStatic = [],
        } = engineConfig ?? {};

        const resolvedExternalFeaturesPath = fs.resolve(
            baseExternalFeaturesPath ?? providedExternalFeatuersPath ?? join(this.basePath, 'node_modules')
        );

        if (serveExternalFeaturesPath) {
            serveStatic.push({
                route: `/${EXTERNAL_FEATURES_BASE_URI}`,
                directoryPath: resolvedExternalFeaturesPath,
            });
        }

        if (serveStatic) {
            for (const { route, directoryPath } of serveStatic) {
                app.use(route, express.static(directoryPath));
            }
        }

        externalFeatureDefinitions.push(...providedExternalFeaturesDefinitions);

        const externalFeatures = getExternalFeatures(
            externalFeatureDefinitions,
            [...getExportedEnvironments(new Map(features))],
            resolvedExternalFeaturesPath
        );

        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            features: new Map(features),
            port,
            defaultRuntimeOptions,
            inspect,
            overrideConfig: config,
            configurations,
            externalFeatures,
        });

        disposables.add(() => nodeEnvironmentManager.closeAll());

        if (publicConfigsRoute) {
            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
                createConfigMiddleware(config),
            ]);
        }

        if (serveExternalFeaturesPath) {
            app.use(`/${EXTERNAL_FEATURES_BASE_URI}`, express.static(resolvedExternalFeaturesPath));
        }

        app.use('/external', (_, res) => {
            res.json(externalFeatures);
        });
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

    public async remote({ port: preferredPort }: IRunApplicationOptions = {}) {
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
            : builtinTemplatesPath;

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
        isExternal,
        externalFeatures,
        fetchFeatures,
    }: ICompilerOptions) {
        const { basePath, outputPath } = this;
        const baseConfigPath = fs.findClosestFileSync(basePath, 'webpack.config.js');
        const baseConfig = (typeof baseConfigPath === 'string' ? require(baseConfigPath) : {}) as webpack.Configuration;

        const environments = getExportedEnvironments(features);
        const webpackConfigs = createWebpackConfigs({
            baseConfig,
            context: basePath,
            mode,
            outputPath,
            environments: Array.from(environments),
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
            createWebpackConfig: isExternal ? createWebpackConfigForExteranlFeature : createWebpackConfig,
            externalFeatures,
            fetchFeatures,
        });

        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return compiler;
    }

    protected analyzeFeatures() {
        const { basePath, featureDiscoveryRoot } = this;

        console.time(`Analyzing Features.`);
        const packages = resolvePackages(basePath);
        const featuresAndConfigs = loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
        console.timeEnd('Analyzing Features.');
        return { ...featuresAndConfigs, packages };
    }

    protected createNodeEntries(
        features: Map<string, IFeatureDefinition>,
        featureName: string,
        singleFeature?: boolean
    ) {
        const nodeEntries: Record<string, string> = {};
        const { nodeEnvs } = getResolvedEnvironments({
            featureName,
            singleFeature,
            features,
            environments: [...getEnvironmntsForFeature(featureName, features, 'node')],
        });
        for (const feature of features.values()) {
            if (featureName === feature.scopedName) {
                for (const [envName, childEnvs] of nodeEnvs) {
                    fs.writeFileSync(
                        join(this.outputPath, `${envName}.node.js`),
                        createExternalNodeEntrypoint({
                            ...feature,
                            childEnvs,
                            envName,
                        })
                    );
                }
            }
        }
        return nodeEntries;
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
                hasServerEnvironments: getEnvironmntsForFeature(scopedName, features, 'node').size > 0,
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
        const nonFoundDependencies: string[] = [];
        const filteredFeatures = [
            ...flattenTree(foundFeature, ({ dependencies }) =>
                dependencies.map((dependencyName) => {
                    const feature = features.get(dependencyName);
                    if (!feature) {
                        nonFoundDependencies.push(dependencyName);
                        return {} as IFeatureDefinition;
                    }
                    return feature;
                })
            ),
        ].map(({ scopedName }) => scopedName);
        if (nonFoundDependencies.length) {
            throw new Error(
                `The following features were not found during feature location: ${nonFoundDependencies.join(',')}`
            );
        }
        for (const [foundFeatureName] of features) {
            if (!filteredFeatures.includes(foundFeatureName)) {
                features.delete(foundFeatureName);
            }
        }
    }
}

const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target as string} using webpack...`);

export function getExportedEnvironments(features: Map<string, IFeatureDefinition>): Set<IEnvironment> {
    const environments = new Set<IEnvironment>();
    for (const { exportedEnvs } of features.values()) {
        for (const exportedEnv of exportedEnvs) {
            environments.add(exportedEnv);
        }
    }
    return environments;
}

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
