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

import { COM, TopLevelConfig } from '@wixc3/engine-core';
import { IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { engineDevMiddleware } from './engine-start-app/engine-dev-middlewere';
import { createBundleConfig } from './create-webpack-config';
import { runNodeEnvironments } from './run-node-environments';
import { resolvePackages } from './utils/resolve-packages';

const rimraf = promisify(rimrafCb);

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    projectPath?: string;
    queryParams?: IQueryParams;
}

export interface IRunOptions extends IFeatureTarget {
    singleRun?: boolean;
}

interface IQueryParams {
    [param: string]: string;
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

    public async start({ featureName, configName }: IRunOptions = {}) {
        const disposables: Array<() => unknown> = [];
        const { features, configurations, packages } = this.analyzeFeatures();
        const compiler = this.createCompiler(features, featureName, configName);
        const runningNodeEnvironments = new Map<
            string,
            Map<
                string,
                {
                    close: () => Promise<void>;
                }
            >
        >();
        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        const socketServer = io(httpServer);
        disposables.push(() => new Promise(res => socketServer.close(res)));
        const topology: Record<string, string> = {};

        app.use('/favicon.ico', noContentHandler);
        app.use('/config', async (req, res) => {
            const requestedConfig = req.path.slice(1);
            const configFilePath = configurations.get(requestedConfig);
            const config: TopLevelConfig = [COM.use({ config: { topology } })];
            if (configFilePath) {
                const { default: configValue } = await import(configFilePath);
                config.push(...configValue);
            }
            res.send(config);
        });

        const devMiddleware = webpackDevMiddleware(compiler, { publicPath: '/', logLevel: 'silent' });
        disposables.push(() => new Promise(res => devMiddleware.close(res)));
        app.use(devMiddleware);

        await new Promise(resolve => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        const mainUrl = `http://localhost:${port}`;
        console.log(`Listening:`);
        console.log(mainUrl);

        const runningFeaturesAndConfigs = this.getConfigNamesForRunningFeatures(features, configurations);

        if (packages.length === 1) {
            // print links to features
            for (const featureName of runningFeaturesAndConfigs.features) {
                for (const configName of runningFeaturesAndConfigs.configs) {
                    console.log(`${mainUrl}/main.html?feature=${featureName}&config=${configName}`);
                }
            }
        }

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
                        `cannot find config ${targetFeature.featureName}. available configurations: ${configNames.join(
                            ', '
                        )}`
                    );
                }
                const { default: topLevelConfig } = await import(configFilePath);
                config.push(...topLevelConfig);
            }

            const runningEnvs = await runNodeEnvironments({
                featureName: targetFeature.featureName,
                config,
                socketServer,
                features
            });

            for (const { name } of runningEnvs.environments) {
                topology[name] = `http://localhost:${port}/_ws`;
            }

            return {
                close: async () => {
                    await runningEnvs.dispose();
                    for (const { name } of runningEnvs.environments) {
                        delete topology[name];
                    }
                }
            };
        };

        app.put('/node-env', async (req, res) => {
            const { configName, featureName, projectPath }: IRunOptions = req.query;
            if (!featureName) {
                res.status(404).json({
                    result: 'error',
                    error: 'featureName should be privoded'
                });
            } else if (!configName) {
                res.status(404).json({
                    result: 'error',
                    error: 'configName should be privoded'
                });
            } else {
                const runningNodeEnv = await runFeature({
                    featureName,
                    configName,
                    projectPath
                });

                if (!runningNodeEnvironments.has(featureName)) {
                    runningNodeEnvironments.set(featureName, new Map());
                }
                runningNodeEnvironments.get(featureName)!.set(configName, runningNodeEnv);

                res.json({
                    result: 'success'
                });
            }
        });

        app.delete('/node-env', async (req, res) => {
            const { configName, featureName }: IRunOptions = req.query;
            if (!featureName) {
                res.status(404).json({
                    result: 'error',
                    error: 'featureName should be provided'
                });
            } else if (!configName) {
                res.status(404).json({
                    result: 'error',
                    error: 'configName should be provided'
                });
            } else if (!runningNodeEnvironments.has(featureName)) {
                res.status(404).json({
                    result: 'error',
                    error: `${featureName} does not have a running node environment`
                });
            } else if (!runningNodeEnvironments.get(featureName)!.has(configName)) {
                res.status(404).json({
                    result: 'error',
                    error: `${featureName} does not have a running node environment for config ${configName}
                    possible configs are ${runningNodeEnvironments.get(featureName)!}
                    `
                });
            } else {
                await runningNodeEnvironments
                    .get(featureName)!
                    .get(configName)!
                    .close();
                res.json({
                    result: 'success'
                });
            }
        });

        app.get('/node-env', (req, res) => {
            const { featureName, configName }: IRunOptions = req.query;
            if (featureName) {
                const feature = runningNodeEnvironments.get(featureName);
                if (!feature) {
                    res.status(404).json({
                        result: 'error',
                        error: `no features are running for ${featureName}`
                    });
                } else {
                    if (configName) {
                        if (!feature.has(configName)) {
                            res.status(404).json({
                                result: 'error',
                                error: `no features are running for ${featureName}`,
                                possibleConfigs: Array.from(feature.keys())
                            });
                        } else {
                            res.json({
                                result: 'success'
                            });
                        }
                    } else {
                        res.json({
                            result: 'success',
                            possibleConfigs: Array.from(feature.keys())
                        });
                    }
                }
            } else {
                const runningFeatureNames = Array.from(runningNodeEnvironments.keys());
                const possibleConfigs: Record<string, string[]> = runningFeatureNames.reduce(
                    (prev, featureName) => {
                        prev[featureName!] = Array.from(runningNodeEnvironments.get(featureName)!.keys());
                        return prev;
                    },
                    {} as Record<string, string[]>
                );

                res.json({
                    result: 'success',
                    possibleConfigs
                });
            }
        });

        const engineDev = engineDevMiddleware({
            runningFeaturesAndConfigs,
            mainUrl
        });
        app.use(engineDev);

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

        const webpackConfig = createBundleConfig({
            context: basePath,
            outputPath,
            enviroments: Array.from(enviroments),
            features,
            featureName,
            configName
        });
        const compiler = webpack(webpackConfig);
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
        configurations: Map<string, string>
    ) {
        const packageToConfigurationMapping: { features: string[]; configs: string[] } = {
            configs: Array.from(configurations.keys()),
            features: []
        };
        for (const [, { scopedName, isRoot }] of features) {
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

const bundleStartMessage = () => console.log('Bundling using webpack...');

function hookCompilerToConsole(compiler: webpack.Compiler): void {
    compiler.hooks.run.tap('engine-scripts', bundleStartMessage);
    compiler.hooks.watchRun.tap('engine-scripts', bundleStartMessage);

    compiler.hooks.done.tap('engine-scripts stats printing', stats => {
        if (stats.hasErrors() || stats.hasWarnings()) {
            console.log(stats.toString());
        }
        console.log('Done bundling.');
    });
}
