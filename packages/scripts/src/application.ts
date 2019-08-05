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

import { COM, TopLevelConfig, flattenTree } from '@wixc3/engine-core';
import { IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { createWebpackConfigs } from './create-webpack-configs';
import { runNodeEnvironments } from './run-node-environments';
import { resolvePackages } from './utils/resolve-packages';
import {
    IEnvironmentMessage,
    ServerEnvironmentOptions,
    IEnvironmaneStartMessage,
    isEnvironmentStartMessage
} from './types';

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
        const compiler = this.createCompiler(features, featureName, configName);

        return new Promise<webpack.Stats>((resolve, reject) =>
            compiler.run((e, s) => (e || s.hasErrors() ? reject(e || new Error(s.toString())) : resolve(s)))
        );
    }

    public async start({ featureName, configName, inspect = false }: IRunOptions = {}) {
        if (process.argv.some(arg => arg.startsWith('--inspect'))) {
            inspect = true;
        }
        const disposables: Array<() => unknown> = [];
        const { features, configurations } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName);

        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        const socketServer = io(httpServer);
        disposables.push(() => socketServer.close());
        disposables.push(() => new Promise(res => httpServer.close(res)));
        const topology: Map<string, Record<string, string>> = new Map();

        app.use('/favicon.ico', noContentHandler);
        app.use('/config', async (req, res) => {
            const { feature: currentFeatureName } = req.query;
            const requestedConfig = req.path.slice(1);
            const configFilePath = configurations.get(requestedConfig);
            const config: TopLevelConfig = [COM.use({ config: { topology: topology.get(currentFeatureName) } })];
            if (configFilePath) {
                const { default: configValue } = await import(configFilePath);
                config.push(...configValue);
            }
            res.send(config);
        });

        for (const childCompiler of compiler.compilers) {
            const devMiddleware = webpackDevMiddleware(childCompiler, { publicPath: '/', logLevel: 'silent' });
            disposables.push(() => new Promise(res => devMiddleware.close(res)));
            app.use(devMiddleware);
        }

        await new Promise(resolve => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        // print links to features
        // const configLinks = this.getRootURLS(environments, featureMapping, port);
        // const engineDev = engineDevMiddleware(features, environments, configLinks);
        // app.use(engineDev);

        console.log(`Listening:`);
        console.log(`http://localhost:${port}/`);

        const runFeature = async (targetFeature: {
            featureName: string;
            configName?: string;
            projectPath?: string;
        }) => {
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
                const configFilePath = configurations.get(targetFeature.configName);
                if (!configFilePath) {
                    const configNames = Array.from(configurations.keys());
                    throw new Error(
                        `cannot find config ${featureName}. available configurations: ${configNames.join(', ')}`
                    );
                }
                try {
                    const { default: topLevelConfig } = await import(configFilePath);
                    config.push(...topLevelConfig);
                } catch (e) {
                    console.error(e);
                }
            }

            const nodeEnvs = getNodeEnvironments(targetFeature.featureName, features);
            const topologyForFeature: Record<string, string> = {};
            for (const environment of nodeEnvs) {
                const remoteEnv = new RemoteNodeEnvironment(join(__dirname, 'init-socket-server.js'));
                const envPort = await remoteEnv.start();
                const { close } = await this.startNodeEnvironment(remoteEnv, {
                    config,
                    environment,
                    featureName: targetFeature.featureName,
                    features,
                    projectPath: targetFeature.projectPath || this.basePath,
                    serverPort: port
                });
                topologyForFeature[environment.name] = `http://localhost:${envPort}/_ws`;
                disposables.push(async () => await close());
                disposables.push(() => remoteEnv.dispose());
            }

            topology.set(targetFeature.featureName, topologyForFeature);

            return {
                close: async () => {
                    for (const dispose of disposables) {
                        await dispose();
                    }
                    disposables.length = 0;
                    if (topology.has(targetFeature.featureName)) {
                        topology.delete(targetFeature.featureName);
                    }
                }
            };
        };

        if (featureName) {
            const { close: closeFeature } = await runFeature({ featureName, configName });
            disposables.push(() => closeFeature());
        }
        return {
            port,
            httpServer,
            runFeature,
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            }
        };
    }

    private createCompiler(features: Map<string, IFeatureDefinition>, featureName?: string, configName?: string) {
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
        return featuresAndConfigs;
    }
    private async startNodeEnvironment(
        remoteNodeEnvironment: RemoteNodeEnvironment,
        { config, features, featureName, environment, serverPort }: ServerEnvironmentOptions
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
                features,
                serverPort
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
