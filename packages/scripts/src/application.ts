// tslint:disable: no-console

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */
import '@stylable/node/register';
import '@ts-tools/node/fast';
import './own-repo-hook';

import fs from '@file-services/node';
import { RemoteNodeEnvironment } from '@wixc3/engine-core-node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import { join } from 'path';
import rimrafCb from 'rimraf';
import { promisify } from 'util';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

import { SetMultiMap } from '@file-services/utils';
import { flattenTree, TopLevelConfig } from '@wixc3/engine-core/src';
import { IConfigDefinition, IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { createConfigMiddleware } from './config-middleware';
import { createWebpackConfigs } from './create-webpack-configs';
import { NodeEnvironmentsManager } from './node-environments-manager';
import {
    IEnvironmaneStartMessage,
    IEnvironmentMessage,
    isEnvironmentStartMessage,
    ServerEnvironmentOptions
} from './types';
import { resolvePackages } from './utils/resolve-packages';

const rimraf = promisify(rimrafCb);

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    projectPath?: string;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
    inspect?: boolean;
}

export class Application {
    /**
     *
     * @param basePath absolute path to feature base folder, where .feature.ts file exists
     * @param outputPath absolute path to output directory
     */
    constructor(public basePath: string = process.cwd(), public outputPath = fs.join(basePath, 'dist')) {}

    public async clean() {
        console.log(`Removing: ${this.outputPath}`);
        await rimraf(this.outputPath);
        await rimraf(fs.join(this.basePath, 'npm'));
    }

    public async build({ featureName, configName }: IRunOptions = {}): Promise<webpack.Stats> {
        const { features } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName, 'production');

        return new Promise<webpack.Stats>((resolve, reject) =>
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
    }

    public async start({ featureName, configName, projectPath, inspect = false }: IRunOptions = {}) {
        if (process.argv.some(arg => arg.startsWith('--inspect'))) {
            inspect = true;
        }
        const disposables: Array<() => unknown> = [];
        const { features, configurations, packages } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName);
        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        disposables.push(() => new Promise(res => httpServer.close(res)));
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
            projectPath?: string;
        }) => {
            const featureDisposables: Array<() => unknown> = [];
            const config: TopLevelConfig = [
                [
                    'project',
                    {
                        fsProjectDirectory: {
                            projectPath: fs.resolve(targetFeature.projectPath || '')
                        }
                    }
                ]
            ];

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

            const nodeEnvs = getNodeEnvironments(targetFeature.featureName, features);
            const topologyForFeature: Record<string, string> = {};
            for (const environment of nodeEnvs) {
                const remoteEnv = new RemoteNodeEnvironment(join(__dirname, 'init-socket-server.js'));
                const envPort = await remoteEnv.start(inspect);
                await this.startNodeEnvironment(remoteEnv, {
                    config,
                    environment,
                    featureName: targetFeature.featureName,
                    features,
                    projectPath: targetFeature.projectPath || this.basePath,
                    httpServerPath: `http://localhost:${port}`
                });
                topologyForFeature[environment.name] = `http://localhost:${envPort}/_ws`;
                featureDisposables.push(() => remoteEnv.dispose());
            }

            topology.set(targetFeature.featureName, topologyForFeature);

            return {
                close: async () => {
                    for (const dispose of featureDisposables) {
                        await dispose();
                    }
                    featureDisposables.length = 0;
                    if (topology.has(targetFeature.featureName)) {
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
            console.log(`auto starting node environment for feature ${featureName} with config ${configName}`);
            await nodeEnvironmentManager.runEnvironment({ featureName, configName, projectPath });
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
    private async startNodeEnvironment(
        remoteNodeEnvironment: RemoteNodeEnvironment,
        { config, features, featureName, environment, httpServerPath, projectPath }: ServerEnvironmentOptions
    ) {
        const envName = environment.name;
        const startMessage = new Promise(resolve => {
            remoteNodeEnvironment.subscribe(message => {
                if (isEnvironmentStartMessage(message)) {
                    resolve();
                }
            });
        });
        const startFeature: IEnvironmaneStartMessage = {
            id: 'start',
            envName,
            data: {
                ...environment,
                config,
                featureName,
                features: mapToRecord(features),
                httpServerPath,
                projectPath
            }
        };
        remoteNodeEnvironment.postMessage(startFeature);

        await startMessage;
        return {
            close: () => {
                return new Promise<void>(resolve => {
                    remoteNodeEnvironment.subscribe(message => {
                        if (message.id === 'close') {
                            resolve();
                        }
                    });
                    const enviroenentCloseServer: IEnvironmentMessage = { id: 'close', envName };
                    remoteNodeEnvironment.postMessage(enviroenentCloseServer);
                });
            }
        };
    }
}

function mapToRecord<K extends string, V>(map: Map<K, V>): Record<K, V> {
    const record: Record<K, V> = {} as Record<K, V>;
    for (const [key, value] of map) {
        record[key] = value;
    }
    return record;
}

function getNodeEnvironments(featureName: string, features: Map<string, IFeatureDefinition>) {
    const nodeEnvs = new Set<IEnvironment>();

    const featureDefinition = features.get(featureName);
    if (!featureDefinition) {
        const featureNames = Array.from(features.keys());
        throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
    }
    const { resolvedContexts: resolvedFeatureContexts } = featureDefinition;
    const deepDefsForFeature = flattenTree(featureDefinition, f => f.dependencies.map(fName => features.get(fName)!));
    for (const { exportedEnvs } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (
                exportedEnv.type === 'node' &&
                (!exportedEnv.childEnvName || resolvedFeatureContexts[exportedEnv.name] === exportedEnv.childEnvName)
            ) {
                nodeEnvs.add(exportedEnv);
            }
        }
    }

    return nodeEnvs;
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
