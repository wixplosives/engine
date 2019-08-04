// tslint:disable: no-console

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */
import fs from '@file-services/node';
import '@stylable/node/register';
import '@ts-tools/node/fast';
import { COM, TopLevelConfig } from '@wixc3/engine-core';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import rimrafCb from 'rimraf';
import io from 'socket.io';
import { promisify } from 'util';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import { IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { createBundleConfig } from './create-webpack-config';
import { NodeEnvironmentsManager } from './node-environments-magager';

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

        const nodeEnvironmentManager = new NodeEnvironmentsManager(runFeature);

        app.use(nodeEnvironmentManager.middlewere());
        disposables.push(() => nodeEnvironmentManager.closeAll());

        app.get('/possible-entities', (_req, res) => {
            res.json({ ...runningFeaturesAndConfigs });
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
