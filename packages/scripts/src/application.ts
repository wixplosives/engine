import { promisify } from 'util';
import { Socket } from 'net';

import bodyParser from 'body-parser';
import { safeListeningHttpServer } from 'create-listening-server';
import express, { Router } from 'express';
import cors from 'cors';
import rimrafCb from 'rimraf';
import io from 'socket.io';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import fs from '@file-services/node';
import { TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import {
    createConfigMiddleware,
    createLiveConfigsMiddleware,
    createTopologyMiddleware,
    ensureTopLevelConfigMiddleware,
    OverrideConfig
} from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { ForkedProcess } from './forked-process';
import { NodeEnvironmentsManager } from './node-environments-manager';
import { createIPC } from './process-communication';
import {
    EngineConfig,
    IConfigDefinition,
    IEnvironment,
    IFeatureDefinition,
    IFeatureMessage,
    IProcessMessage,
    ICloseFeatureOptions
} from './types';
import { resolvePackages } from './utils/resolve-packages';
import generateFeature, { pathToFeaturesDirectory } from './feature-generator';

const rimraf = promisify(rimrafCb);
const { basename, extname, join } = fs;
export const DEFAULT_PORT = 3000;

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
}

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
    private basePath: string;

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
        publicConfigsRoute
    }: IRunOptions = {}): Promise<webpack.Stats> {
        await this.loadRequiredModulesFromEngineConfig();
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
            publicConfigsRoute
        });

        const stats = await new Promise<webpack.Stats>((resolve, reject) =>
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
            configName
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
        config = [],
        publicPath,
        mode = 'development',
        singleFeature,
        title,
        publicConfigsRoute = 'configs/'
    }: IRunOptions = {}) {
        await this.loadRequiredModulesFromEngineConfig();

        const disposables = new Set<() => unknown>();
        const { port, app, close, socketServer } = await this.launchHttpServer({
            httpServerPort
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
            publicConfigsRoute
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
                        invalidate: () => undefined
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
            config
        });
        disposables.add(() => nodeEnvironmentManager.closeAll());

        const configMap = new Map<string, OverrideConfig>();

        app.use(`/${publicConfigsRoute}`, [
            ensureTopLevelConfigMiddleware,
            createTopologyMiddleware(nodeEnvironmentManager, publicPath),
            createLiveConfigsMiddleware(configurations, this.basePath, configMap),
            createConfigMiddleware(config)
        ]);

        for (const childCompiler of compiler.compilers) {
            const devMiddleware = webpackDevMiddleware(childCompiler, {
                publicPath: '/',
                logLevel: 'silent'
            });
            disposables.add(() => new Promise(res => devMiddleware.close(res)));
            app.use(devMiddleware);
        }

        await new Promise(resolve => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        const mainUrl = `http://localhost:${port}/`;
        console.log(`Listening:`);
        console.log('Dashboard URL: ', mainUrl);
        if (featureName) {
            console.log('Main application URL: ', `${mainUrl}main.html`);
        }

        const featureEnvDefinitions = this.getFeatureEnvDefinitions(features, configurations, nodeEnvironmentManager);

        if (packages.length === 1) {
            // print links to features
            console.log('Available Configurations:');
            for (const { configurations, featureName } of Object.values(featureEnvDefinitions)) {
                for (const runningConfigName of configurations) {
                    console.log(`${mainUrl}main.html?feature=${featureName}&config=${runningConfigName}`);
                }
            }
        }

        app.use('/engine-feature', this.createFeaturesEngineRouter(configMap, nodeEnvironmentManager));

        app.get('/engine-state', (_req, res) => {
            res.json({
                result: 'success',
                data: {
                    features: featureEnvDefinitions,
                    featuresWithRunningNodeEnvs: nodeEnvironmentManager.getFeaturesWithRunningEnvironments()
                }
            });
        });

        if (featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName,
                overrideConfigsMap: configMap
            });
        }

        return {
            port,
            nodeEnvironmentManager,
            router: app,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.clear();
            },
            runFeature: async ({ featureName, runtimeOptions = {}, configName, config }: IRunFeatureOptions) => {
                if (config) {
                    configName = this.generateOverrideConfig(configMap, config, configName);
                }
                await nodeEnvironmentManager.runServerEnvironments({
                    featureName,
                    configName,
                    overrideConfigsMap: configMap,
                    runtimeOptions
                });
                return configName;
            },
            closeFeature: ({ featureName, configName }: ICloseFeatureOptions) => {
                if (configName) {
                    configMap.delete(configName);
                }
                return nodeEnvironmentManager.closeEnvironment({
                    featureName,
                    configName
                });
            }
        };
    }

    public createFeaturesEngineRouter(
        overrideConfigsMap: Map<string, OverrideConfig>,
        nodeEnvironmentManager: NodeEnvironmentsManager
    ) {
        const router = Router();
        router.use(bodyParser.json());

        router.put('/', async (req, res) => {
            const { configName, featureName, runtimeOptions: options, config }: Required<IFeatureTarget> = req.body;
            try {
                const generatedConfigName = this.generateConfigName(configName);
                overrideConfigsMap.set(generatedConfigName, { config, configName });
                await nodeEnvironmentManager.runServerEnvironments({
                    configName,
                    featureName,
                    runtimeOptions: options,
                    overrideConfigsMap
                });
                res.json({
                    id: 'feature-initialized',
                    payload: {
                        configName: generatedConfigName,
                        featureName
                    }
                } as IProcessMessage<IFeatureMessage>);
            } catch (error) {
                res.status(404).json({
                    id: 'error',
                    error: error && error.message
                });
            }
        });

        router.delete('/', async (req, res) => {
            const { featureName, configName }: Required<IFeatureTarget> = req.body;
            overrideConfigsMap.delete(configName);
            try {
                await nodeEnvironmentManager.closeEnvironment({ featureName, configName });
                res.json({
                    id: 'feature-closed',
                    payload: {
                        featureName,
                        configName
                    }
                } as IProcessMessage<IFeatureMessage>);
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error && error.message
                });
            }
        });

        router.get('/', (_req, res) => {
            try {
                const data = nodeEnvironmentManager.getFeaturesWithRunningEnvironments();
                res.json({
                    result: 'success',
                    data
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error && error.message
                });
            }
        });

        return router;
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
            config: userConfig = [],
            publicPath,
            publicConfigsRoute
        } = runOptions;
        const disposables = new Set<() => unknown>();
        const configurations = await this.readConfigs();

        const { port, close, socketServer, app } = await this.launchHttpServer({
            httpServerPort
        });
        const config: TopLevelConfig = [];
        disposables.add(() => close());

        config.push(...userConfig);
        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            features: new Map(features),
            port,
            defaultRuntimeOptions,
            inspect,
            config,
            configurations
        });
        disposables.add(() => nodeEnvironmentManager.closeAll());

        if (publicConfigsRoute) {
            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createTopologyMiddleware(nodeEnvironmentManager, publicPath),
                createConfigMiddleware(config)
            ]);
        }

        if (featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName
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
            }
        };
    }

    public async remote({ port: preferredPort }: IRunOptions = {}) {
        if (!process.send) {
            throw new Error('"remote" command can only be used in a forked process');
        }

        await this.loadRequiredModulesFromEngineConfig();
        const { socketServer, close, port } = await this.launchHttpServer({
            httpServerPort: preferredPort
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
            featureDirNameTemplate
        });
    }

    private async getEngineConfig() {
        const engineConfigFilePath = await fs.promises.findClosestFile(this.basePath, ENGINE_CONFIG_FILE_NAME);
        if (engineConfigFilePath) {
            try {
                return (await import(engineConfigFilePath)) as EngineConfig;
            } catch (ex) {
                throw new Error(`failed evaluating config file: ${engineConfigFilePath}`);
            }
        }
        return null;
    }

    private async loadRequiredModulesFromEngineConfig() {
        const config = await this.getEngineConfig();

        if (config) {
            const { require: requiredModules = [] } = config;

            for (const requiredModule of requiredModules) {
                try {
                    await import(requiredModule);
                } catch (ex) {
                    throw new Error(`failed requiring: ${requiredModule}`);
                }
            }
        }
    }

    private async readConfigs(): Promise<SetMultiMap<string, TopLevelConfig>> {
        const configurations = new SetMultiMap<string, TopLevelConfig>();
        const configsDirectoryPath = join(this.outputPath, 'configs');
        if (await fs.promises.exists(configsDirectoryPath)) {
            const folderEntities = await fs.promises.readdir(configsDirectoryPath, { withFileTypes: true });
            for (const entity of folderEntities) {
                if (entity.isDirectory()) {
                    const featureName = entity.name;
                    const featureConfigsDirectory = join(configsDirectoryPath, featureName);
                    const featureConfigsEntities = await fs.promises.readdir(featureConfigsDirectory, {
                        withFileTypes: true
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

    private async writeManifest({
        features,
        featureName,
        configName
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
    }) {
        const manifest: IBuildManifest = {
            features: Array.from(features.entries()),
            defaultConfigName: configName,
            defaultFeatureName: featureName
        };

        await fs.promises.ensureDirectory(this.outputPath);
        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    private createCompiler({
        features,
        featureName,
        configName,
        publicPath,
        mode,
        title,
        configurations,
        staticBuild,
        publicConfigsRoute
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
            publicConfigsRoute
        });

        const compiler = webpack(webpackConfigs);
        hookCompilerToConsole(compiler);
        return compiler;
    }

    private analyzeFeatures() {
        const { basePath } = this;
        console.time(`Analyzing Features.`);
        const packages = resolvePackages(basePath);
        const featuresAndConfigs = loadFeaturesFromPackages(packages, fs);
        console.timeEnd('Analyzing Features.');
        return { ...featuresAndConfigs, packages };
    }

    private getFeatureEnvDefinitions(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>,
        nodeEnvironmentManager: NodeEnvironmentsManager
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
                configurations: configNames.filter(name => name.includes(rootFeatureName)),
                hasServerEnvironments: nodeEnvironmentManager.getNodeEnvironments(scopedName).size > 0,
                featureName: scopedName
            };
        }

        return featureEnvDefinitions;
    }

    private async launchHttpServer({ httpServerPort = DEFAULT_PORT }: { httpServerPort?: number }) {
        const app = express();
        app.use(cors());
        const openSockets = new Set<Socket>();
        const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);
        httpServer.on('connection', socket => {
            openSockets.add(socket);
            socket.once('close', () => openSockets.delete(socket));
        });

        app.use('/', express.static(this.outputPath));

        app.use('/favicon.ico', noContentHandler);

        const socketServer = io(httpServer);

        return {
            close: async () => {
                await new Promise(res => {
                    for (const connection of openSockets) {
                        connection.destroy();
                    }
                    openSockets.clear();
                    socketServer.close(res);
                });
            },
            port,
            app,
            socketServer
        };
    }

    private filterByFeatureName(features: Map<string, IFeatureDefinition>, featureName: string) {
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

    private generateOverrideConfig(
        configMap: Map<string, OverrideConfig>,
        config: TopLevelConfig,
        configName?: string
    ) {
        const generatedConfigName = this.generateConfigName(configName);
        configMap.set(generatedConfigName, { config, configName });
        configName = generatedConfigName;
        return configName;
    }

    private generateConfigName(configName?: string) {
        return `${configName}__${Math.random()
            .toString(16)
            .slice(2)}`;
    }
}

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target} using webpack...`);

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
