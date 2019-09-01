// tslint:disable: no-console

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */
import '@stylable/node/register';
import '@ts-tools/node/fast';
import './own-repo-hook';

import fs from '@file-services/node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import rimrafCb from 'rimraf';
import io from 'socket.io';
import { promisify } from 'util';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

import { SetMultiMap } from '@file-services/utils';
import { loadFeaturesFromPackages } from './analyze-feature';
import { createConfigMiddleware } from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { NodeEnvironmentsManager } from './node-environments-manager';
import { IConfigDefinition, IEnvironment, IFeatureDefinition } from './types';
import { resolvePackages } from './utils/resolve-packages';

const rimraf = promisify(rimrafCb);
const { basename, dirname, extname, join } = fs;

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    options?: Record<string, string | boolean>;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
    inspect?: boolean;
}

export interface IBuildManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
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

    public async build({ featureName, configName }: IRunOptions = {}): Promise<webpack.Stats> {
        const { features, configurations } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName, 'production');

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

    public async start({ featureName, configName, options, inspect = false }: IRunOptions = {}) {
        const disposables: Array<() => unknown> = [];
        const { port, app, close, socketServer } = await this.launchHttpServer();

        const { features, configurations, packages } = this.analyzeFeatures();

        const compiler = this.createCompiler(features, featureName, configName);

        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            configurations,
            features,
            port,
            inspect
        });

        app.use('/config', createConfigMiddleware(configurations, nodeEnvironmentManager.topology));

        for (const childCompiler of compiler.compilers) {
            const devMiddleware = webpackDevMiddleware(childCompiler, { publicPath: '/', logLevel: 'silent' });
            disposables.push(() => new Promise(res => devMiddleware.close(res)));
            app.use(devMiddleware);
        }

        await new Promise(resolve => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        const mainUrl = `http://localhost:${port}`;
        console.log(`Listening:`);
        console.log(mainUrl);

        const runningFeaturesAndConfigs = this.getConfigNamesForRunningFeatures(features, configurations);

        if (packages.length === 1) {
            // print links to features
            for (const runningFeatureName of runningFeaturesAndConfigs.features) {
                for (const runningConfigName of runningFeaturesAndConfigs.configs) {
                    console.log(`${mainUrl}/main.html?feature=${runningFeatureName}&config=${runningConfigName}`);
                }
            }
        }

        app.use(
            nodeEnvironmentManager.middleware({
                inspect
            })
        );

        disposables.push(() => close());

        app.get('/server-state', (_req, res) => {
            res.json({
                result: 'success',
                data: {
                    configs: Array.from(configurations.keys()),
                    features: Array.from(features.values())
                        .filter(({ isRoot }) => isRoot)
                        .map(({ scopedName }) => scopedName),
                    runningNodeEnvironments: nodeEnvironmentManager.getFeaturesWithRunningEnvironments()
                }
            });
        });
        if (featureName) {
            await nodeEnvironmentManager.runEnvironment({
                featureName,
                configName,
                options: { ...options, inspect }
            });
            disposables.push(() => nodeEnvironmentManager.closeEnvironment({ featureName }));
        }

        disposables.push(() => nodeEnvironmentManager.closeAll());

        return {
            port,
            nodeEnvironmentManager,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            }
        };
    }

    public async run(runOptions: IRunOptions = {}) {
        const { features, defaultConfigName, defaultFeatureName } = (await fs.promises.readJsonFile(
            join(this.outputPath, 'manifest.json')
        )) as IBuildManifest;

        const { configName: providedConfigName, featureName = defaultFeatureName, options, inspect } = runOptions;
        const disposables: Array<() => unknown> = [];

        const configurations = await this.readConfigs();

        const configName = providedConfigName || defaultConfigName;

        const { port, close, socketServer, app } = await this.launchHttpServer();

        const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
            configurations,
            features: new Map(features),
            port,
            inspect
        });

        app.use('/config', createConfigMiddleware(configurations, nodeEnvironmentManager.topology));

        disposables.push(() => close());

        if (featureName) {
            await nodeEnvironmentManager.runEnvironment({
                featureName,
                configName,
                options
            });
            disposables.push(() => nodeEnvironmentManager.closeEnvironment({ featureName }));
        }

        console.log(`Listening:`);
        console.log(`http://localhost:${port}/main.html`);

        return {
            port,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            }
        };
    }

    private async readConfigs(): Promise<SetMultiMap<string, IConfigDefinition>> {
        const configurations = new SetMultiMap<string, IConfigDefinition>();
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
                            )) as IConfigDefinition;

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
            await fs.promises.writeFile(configFilePath, JSON.stringify(config, null, 2));
        }
    }

    private createCompiler(
        features: Map<string, IFeatureDefinition>,
        featureName?: string,
        configName?: string,
        mode?: 'production' | 'development'
    ) {
        const { basePath, outputPath } = this;
        const enviroments = new Set<IEnvironment>();
        for (const { exportedEnvs } of features.values()) {
            for (const exportedEnv of exportedEnvs) {
                if (exportedEnv.type !== 'node') {
                    enviroments.add(exportedEnv);
                }
            }
        }

        const webpackConfigs = createWebpackConfigs({
            context: basePath,
            mode,
            outputPath,
            enviroments: Array.from(enviroments),
            features,
            featureName,
            configName
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

    private getConfigNamesForRunningFeatures(
        features: Map<string, IFeatureDefinition>,
        configurations: SetMultiMap<string, IConfigDefinition>
    ) {
        const packageToConfigurationMapping: { features: string[]; configs: string[] } = {
            configs: Array.from(configurations.keys()),
            features: []
        };
        for (const { scopedName, isRoot } of features.values()) {
            if (isRoot) {
                packageToConfigurationMapping.features.push(scopedName);
            }
        }
        return packageToConfigurationMapping;
    }

    private async launchHttpServer() {
        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);

        app.use('/favicon.ico', noContentHandler);
        app.use('/', express.static(this.outputPath));
        const socketServer = io(httpServer);

        return {
            close: async () => new Promise(res => socketServer.close(res)),
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
