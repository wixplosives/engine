// tslint:disable: no-console

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */
import '@stylable/node/register';
import '@ts-tools/node/fast';
import './own-repo-hook';

import fs from '@file-services/node';
import { COM, TopLevelConfig } from '@wixc3/engine-core';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import rimrafCb from 'rimraf';
import io from 'socket.io';
import { promisify } from 'util';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

import { SetMultiMap } from '@file-services/utils';
import { join } from 'path';
import { IConfigDefinition, IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { createConfigMiddleware } from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { IClosable, NodeEnvironmentsManager } from './node-environments-manager';
import { runNodeEnvironments } from './run-node-environments';
import { resolvePackages } from './utils/resolve-packages';

const rimraf = promisify(rimrafCb);

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    options?: Record<string, string>;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
}

export interface IManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
}

export class Application {
    /**
     *
     * @param basePath absolute path to feature base folder, where .feature.ts file exists
     * @param outputPath absolute path to output directory
     */
    constructor(public basePath: string = process.cwd(), public outputPath = fs.join(basePath, 'dist')) {}

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

        const manifest: IManifest = {
            features: Array.from(features.entries()),
            defaultConfigName: configName,
            defaultFeatureName: featureName
        };

        await fs.promises.writeFile(
            join(this.outputPath, 'manifest.json'),
            JSON.stringify(manifest, (_name, value) => {
                if (value instanceof Map) {
                    return Array.from(value.entries());
                }
                return value;
            })
        );

        const configsFolderPath = join(this.outputPath, 'configs');
        await fs.promises.mkdir(configsFolderPath);
        for (const [currentConfigName, config] of configurations) {
            await fs.promises.writeFile(join(configsFolderPath, `${currentConfigName}.json`), JSON.stringify(config));
        }

        return stats;
    }

    public async start({ featureName, configName }: IRunOptions = {}) {
        const disposables: Array<() => unknown> = [];
        const { features, configurations, packages } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName);
        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        const socketServer = io(httpServer);
        disposables.push(() => new Promise(res => socketServer.close(res)));
        const topology: Map<string, Record<string, string>> = new Map();

        app.use('/favicon.ico', noContentHandler);
        app.use('/config', createConfigMiddleware(configurations, topology));

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

        const runFeature = async (targetFeature: {
            featureName: string;
            configName?: string;
            options?: Map<string, string>;
        }) => {
            const config: TopLevelConfig = [];

            if (targetFeature.configName) {
                const configDefinition = configurations.get(targetFeature.configName);
                if (!configDefinition) {
                    const configNames = Array.from(configurations.keys());
                    throw new Error(
                        `cannot find config "${
                            targetFeature.featureName
                        }". available configurations: ${configNames.join(', ')}`
                    );
                }
                for (const { filePath } of configDefinition) {
                    try {
                        const { default: topLevelConfig } = await import(filePath);
                        config.push(...topLevelConfig);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            const runningEnvs = await runNodeEnvironments({
                featureName: targetFeature.featureName,
                config,
                socketServer,
                features,
                options: targetFeature.options
            });

            const topologyForFeature: Record<string, string> = {};
            for (const { name } of runningEnvs.environments) {
                topologyForFeature[name] = `http://localhost:${port}/_ws`;
            }
            topology.set(targetFeature.featureName, topologyForFeature);

            return {
                close: async () => {
                    await runningEnvs.dispose();
                    if (topology.has(targetFeature.featureName)) {
                        for (const { name } of runningEnvs.environments) {
                            delete topology.get(targetFeature.featureName)![name];
                        }
                        topology.delete(targetFeature.featureName);
                    }
                }
            };
        };

        const nodeEnvironmentManager = new NodeEnvironmentsManager(runFeature);

        app.use(nodeEnvironmentManager.middleware());
        disposables.push(() => nodeEnvironmentManager.closeAll());

        app.get('/server-state', (_req, res) => {
            res.json({
                result: 'success',
                data: {
                    configs: Array.from(configurations.keys()),
                    features: Array.from(features.values())
                        .filter(({ isRoot }) => isRoot)
                        .map(({ scopedName }) => scopedName),
                    runningNodeEnvironments: nodeEnvironmentManager.getRunningEnvironments()
                }
            });
        });

        if (featureName) {
            const { close: closeFeature } = await runFeature({ featureName, configName });
            disposables.push(() => closeFeature());
        }
        return {
            port,
            httpServer,
            nodeEnvironmentManager,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            }
        };
    }

    public async run(runOptions?: IRunOptions) {
        const { features, defaultConfigName, defaultFeatureName } = (await fs.promises.readJsonFile(
            join(this.outputPath, 'manifest.json')
        )) as IManifest;

        const { configName, featureName = defaultFeatureName }: IRunOptions = {
            ...runOptions
        };

        const disposables: Array<() => unknown> = [];

        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);

        const topology: Record<string, string> = {};

        const baseConfig: TopLevelConfig = [COM.use({ config: { topology } })];
        let config: TopLevelConfig = [...baseConfig];
        const providedConfigName = configName || defaultConfigName;

        if (providedConfigName) {
            // read config file.
            const configFilePath = fs.join(this.outputPath, 'configs', `${providedConfigName}.ts`);
            if (fs.existsSync(configFilePath)) {
                config.push(...(fs.readJsonFileSync(configFilePath) as Array<[string, object]>));
            }
        }

        app.use('/favicon.ico', noContentHandler);
        app.use('/config', (_req, res) => {
            // serve config
            res.json(config);
        });
        app.use('/', express.static(this.outputPath));
        const socketServer = io(httpServer);
        disposables.push(() => new Promise(res => socketServer.close(res)));

        const runNodeEnv = async (targetFeature: {
            featureName: string;
            configName?: string;
            options?: Map<string, string>;
        }) => {
            if (configName) {
                const configFilePath = fs.join(this.outputPath, 'configs', `${configName}.ts`);
                if (fs.existsSync(configFilePath)) {
                    config = fs.readJsonFileSync(configFilePath) as Array<[string, object]>;
                }
            }
            const { dispose, environments } = await runNodeEnvironments({
                featureName: targetFeature.featureName,
                config,
                features: new Map(features),
                socketServer,
                options: targetFeature.options ? new Map(Object.entries(targetFeature.options)) : undefined
            });

            for (const { name } of environments) {
                topology[name] = `http://localhost:${port}/_ws`;
            }

            return {
                async close() {
                    return dispose();
                }
            } as IClosable;
        };

        const nodeEnvironmentManager = new NodeEnvironmentsManager(runNodeEnv);

        if (featureName) {
            await nodeEnvironmentManager.runEnvironment({
                featureName,
                configName
            });
            disposables.push(() => nodeEnvironmentManager.closeEnvironment({ featureName }));
        }

        const mainUrl = `http://localhost:${port}`;
        console.log(`Listening:`);
        console.log(mainUrl);

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
