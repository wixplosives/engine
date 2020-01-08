import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import rimrafCb from 'rimraf';
import io from 'socket.io';
import { promisify } from 'util';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

import { Socket } from 'net';

import fs from '@file-services/node';
import { SetMultiMap } from '@file-services/utils';
import { TopLevelConfig } from '@wixc3/engine-core';

import { loadFeaturesFromPackages } from './analyze-feature';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants';
import { createConfigMiddleware } from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { ForkedProcess } from './forked-process';
import { NodeEnvironmentsManager } from './node-environments-manager';
import { createIPC } from './process-communication';
import { EngineConfig, IConfigDefinition, IEnvironment, IFeatureDefinition, IExportedConfigDefinition } from './types';
import { resolvePackages } from './utils/resolve-packages';
import generateFeature, { pathToFeaturesDirectory } from './feature-generator';

const rimraf = promisify(rimrafCb);
const { basename, dirname, extname, join } = fs;
export const DEFAULT_PORT = 3000;

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
    inspect?: boolean;
    port?: number;
    publicPath?: string;
    mode?: 'development' | 'production';
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

    public async build({ featureName, configName, publicPath, mode = 'production' }: IRunOptions = {}): Promise<
        webpack.Stats
    > {
        await this.loadRequiredModulesFromEngineConfig();
        const { features, configurations } = this.analyzeFeatures();
        const compiler = this.createCompiler({
            mode,
            features,
            featureName,
            configName,
            publicPath
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
        await this.writeConfigFiles(configurations);

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
        publicPath = '/',
        mode = 'development'
    }: IRunOptions = {}) {
        const normilizedPublicPath = normalizePublicPath(publicPath);
        await this.loadRequiredModulesFromEngineConfig();

        const disposables = new Set<() => unknown>();
        const { port, app, close, socketServer } = await this.launchHttpServer({
            httpServerPort,
            featureName,
            configName
        });
        disposables.add(() => close());

        const { features, configurations, packages } = this.analyzeFeatures();

        const compiler = this.createCompiler({
            mode,
            features,
            featureName,
            configName,
            publicPath: normilizedPublicPath
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
        const middleware = createConfigMiddleware(
            configurations,
            nodeEnvironmentManager.topology,
            normilizedPublicPath
        );

        let currentConfig = config;

        const middlewareConfigProxy: express.RequestHandler = (req, res, next) =>
            middleware(currentConfig)(req, res, next);

        app.use('/config', middlewareConfigProxy);

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

        const mainUrl = `http://localhost:${port}${normilizedPublicPath}`;
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

        app.use(nodeEnvironmentManager.middleware());

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
                configName
            });
        }

        return {
            port,
            nodeEnvironmentManager,
            router: app,
            setRunningConfig: (config: TopLevelConfig = []) => {
                currentConfig = config;
            },
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.clear();
            }
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
            config: userConfig = [],
            publicPath = '/'
        } = runOptions;
        const disposables = new Set<() => unknown>();
        const normilizedPublicPath = normalizePublicPath(publicPath);
        const configurations = await this.readConfigs();

        const { port, close, socketServer, app } = await this.launchHttpServer({
            httpServerPort,
            featureName,
            configName
        });
        const config: TopLevelConfig = [];
        disposables.add(() => close());
        const topLevelConfigs = configName ? configurations.get(configName) : undefined;
        if (topLevelConfigs) {
            const providedConfigs = Array.from(topLevelConfigs.values()).map(({ config }) => config);
            for (const topLevelConfig of providedConfigs) {
                config.push(...topLevelConfig);
            }
        }
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
        const configMiddleware = createConfigMiddleware(
            configurations,
            nodeEnvironmentManager.topology,
            normilizedPublicPath
        );
        app.use(`/config`, configMiddleware(config));

        if (featureName) {
            await nodeEnvironmentManager.runServerEnvironments({
                featureName,
                configName
            });

            console.log(`Listening:`);
            console.log(`http://localhost:${port}${normilizedPublicPath}main.html`);
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

    private async readConfigs(): Promise<SetMultiMap<string, IExportedConfigDefinition>> {
        const configurations = new SetMultiMap<string, IExportedConfigDefinition>();
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
                            const configName = basename(possibleConfigFile.name, fileExtention);

                            const config = (await fs.promises.readJsonFile(
                                join(featureConfigsDirectory, possibleConfigFile.name)
                            )) as IExportedConfigDefinition;

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

        await fs.promises.writeFile(join(this.outputPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
    }

    private async writeConfigFiles(configurations: SetMultiMap<string, IConfigDefinition>) {
        const configsFolderPath = join(this.outputPath, 'configs');
        for (const [currentConfigName, config] of configurations) {
            const configFilePath = join(configsFolderPath, `${currentConfigName}.json`);
            await fs.promises.ensureDirectory(dirname(configFilePath));
            const configFileContent: IExportedConfigDefinition = {
                ...config,
                config: require(config.filePath).default
            };
            await fs.promises.writeFile(configFilePath, JSON.stringify(configFileContent, null, 2));
        }
    }

    private createCompiler({
        features,
        featureName,
        configName,
        publicPath = '/',
        mode
    }: {
        features: Map<string, IFeatureDefinition>;
        featureName?: string;
        configName?: string;
        publicPath?: string;
        mode?: 'production' | 'development';
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
            publicPath
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

    private async launchHttpServer({
        httpServerPort = DEFAULT_PORT,
        featureName,
        configName
    }: {
        httpServerPort?: number;
        featureName?: string;
        configName?: string;
    }) {
        const app = express();
        const openSockets = new Set<Socket>();
        const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);
        httpServer.on('connection', socket => {
            openSockets.add(socket);
            socket.once('close', () => openSockets.delete(socket));
        });

        app.use('/', express.static(this.outputPath));

        app.use('/favicon.ico', noContentHandler);
        app.use('/defaults', (_, res) => {
            res.json({
                featureName,
                configName
            });
        });

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
}

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

const bundleStartMessage = ({ options: { target } }: webpack.Compiler) =>
    console.log(`Bundling ${target} using webpack...`);

function normalizePublicPath(publicPath: string) {
    if (!publicPath.startsWith('/')) {
        publicPath = `/${publicPath}`;
    }
    if (!publicPath.endsWith('/')) {
        publicPath = `${publicPath}/`;
    }
    return publicPath;
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
