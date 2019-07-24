// tslint:disable: no-console

/**
 * We use Node's native module system to directly load configuration file.
 * This configuration can (and should) be written as a `.ts` file.
 */
import '@stylable/node/register';
import '@ts-tools/node/fast';

import fs from '@file-services/node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

import { join } from 'path';
import { engineDevMiddleware } from './engine-dev-middleware';
import { createEnvWebpackConfig, createStaticWebpackConfigs } from './engine-utils/create-webpack-config';
import { FeatureLocator } from './engine-utils/feature-locator';
import { RemoteNodeEnvironment } from './remote-node-environment';
import { EngineEnvironmentEntry, FeatureMapping, isEnvironmentStartMessage, LinkInfo } from './types';
import { resolvePackages } from './utils/resolve-packages';
import { rimraf } from './utils/rimraf';

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    projectPath?: string;
    queryParams?: IQueryParams;
}

export interface IStartOptions {
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

    public async build(featureName?: string, configName?: string): Promise<webpack.Stats> {
        const {
            environments,
            featureMapping: { rootFeatureName }
        } = this.prepare(true, featureName, configName);
        console.log('Bundling using webpack...');
        const webpackConfig = this.createStaticConfig(environments, rootFeatureName, configName!);
        return new Promise((res, rej) => {
            webpack(webpackConfig, (err, stats) => (err ? rej(err) : res(stats)));
        });
    }

    public async start({ singleRun = false }: IStartOptions = {}) {
        const { environments, featureMapping, features } = this.prepare();
        const app = express();
        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        const remoteNodeEnvironment = new RemoteNodeEnvironment(join(__dirname, 'init-socket-server.js'));
        const environmentPort = await remoteNodeEnvironment.start();
        const compiler = webpack(this.createConfig(environments, environmentPort));

        app.use('/favicon.ico', (_req, res) => {
            res.status(204); // No Content
            res.end();
        });

        compiler.hooks.watchRun.tap('engine-scripts', () => {
            console.log('Bundling using webpack...');
        });

        compiler.hooks.done.tap('engine-scripts stats printing', stats => {
            if (stats.hasErrors() || stats.hasWarnings()) {
                console.log(stats.toString());
            }
            console.log('Done bundling.');
        });

        // webpack watcher sometimes throws a uv_close error when it is being closed.
        // this is causing flaky tests and is happenning because of there is a bug in the
        // watch service webpack is using. this is a workaround for us that when in 'test'
        // mode we will not watch the bundled files, but only run them.

        if (singleRun) {
            compiler.watch = (_watchOptions, handler) => compiler.run(handler) as any;
        }

        const dev = webpackDevMiddleware(compiler, { publicPath: '/', logLevel: 'silent' });
        app.use(dev);

        await new Promise<webpack.Stats>(resolve => {
            compiler.hooks.done.tap('engine-scripts init', resolve);
        });

        const configLinks = this.getRootURLS(environments, featureMapping, port);
        const engineDev = engineDevMiddleware(features, environments, configLinks);
        app.use(engineDev);

        console.log(`Listening:`);
        console.log(`http://localhost:${port}/`);
        configLinks.forEach(({ url }) => console.log(url));

        const runFeature = async ({ featureName, configName, projectPath }: IFeatureTarget) => {
            const projectDirectoryPath = projectPath ? fs.resolve(projectPath) : process.cwd();
            const nodeEnvironments = environments.filter(({ target }) => target === 'node');
            const closeEnvironmentsHandlers: Array<{ close: () => Promise<void> }> = [];
            for (const environment of nodeEnvironments) {
                closeEnvironmentsHandlers.push(
                    await this.startNodeEnvironment(
                        environment,
                        remoteNodeEnvironment,
                        featureMapping,
                        featureName,
                        configName,
                        projectDirectoryPath
                    )
                );
            }

            return {
                close: async () => {
                    for (const handler of closeEnvironmentsHandlers) {
                        await handler.close();
                    }
                }
            };
        };
        return {
            port,
            httpServer,
            runFeature,
            async close() {
                await new Promise(res => dev.close(res));
                remoteNodeEnvironment.dispose();
                await new Promise(res => httpServer.close(res));
            }
        };
    }

    private prepare(buildSingleFeature: boolean = false, featureName?: string, configName?: string) {
        const { basePath } = this;
        console.time(`Analyzing Features.`);
        const [firstPackage] = resolvePackages(basePath);

        if (!firstPackage) {
            throw new Error(`cannot find feature package in ${basePath}`);
        }

        const { directoryPath } = firstPackage;
        const featureLocator = new FeatureLocator(directoryPath, fs);
        const featureMapping = featureLocator.createFeatureMapping(buildSingleFeature, featureName, configName);
        const features = featureLocator.locateFeatureEntities(featureMapping.bootstrapFeatures);
        featureLocator.addContextsToFeatureMapping(features, featureMapping);
        const environments = featureLocator.createEnvironmentsEntries(features, featureMapping);
        console.timeEnd('Analyzing Features.');
        return { environments, features, featureMapping };
    }

    private getRootURLS(environments: EngineEnvironmentEntry[], featureMapping: FeatureMapping, port: number) {
        const urls: LinkInfo[] = [];
        environments
            .filter(({ target, isRoot }) => target === 'web' && isRoot)
            .forEach(envEntry => {
                Object.keys(featureMapping.mapping).forEach(feature => {
                    const featureWithConfig = featureMapping.mapping[feature];
                    const configurations = Object.keys(featureWithConfig.configurations);
                    if (configurations.length) {
                        configurations.forEach(config =>
                            urls.push(this.buildUrl(port, envEntry.name, feature, config))
                        );
                    } else {
                        urls.push(this.buildUrl(port, envEntry.name, feature));
                    }
                });
            });

        return urls;
    }

    private buildUrl(port: number, entry: string, feature: string, config?: string) {
        let url = `http://localhost:${port}/${entry}.html?feature=${feature}`;
        if (config) {
            url += `&config=${config}`;
        }
        return {
            url,
            feature,
            config
        };
    }

    private createConfig(environments: EngineEnvironmentEntry[], port?: number): webpack.Configuration {
        return createEnvWebpackConfig({
            port,
            environments,
            basePath: this.basePath,
            outputPath: this.outputPath
        });
    }

    private createStaticConfig(
        environments: EngineEnvironmentEntry[],
        currentFeatureName: string,
        currentConfigName: string
    ): webpack.Configuration[] {
        return createStaticWebpackConfigs({
            environments,
            basePath: this.basePath,
            outputPath: this.outputPath,
            currentConfigName,
            currentFeatureName
        });
    }
    private async startNodeEnvironment(
        environment: EngineEnvironmentEntry,
        remoteNodeEnvironment: RemoteNodeEnvironment,
        featureMapping: FeatureMapping,
        featureName: string | undefined,
        configName: string | undefined,
        projectDirectoryPath: string
    ) {
        const envName = environment.name;
        const startMessage = new Promise(resolve => {
            remoteNodeEnvironment.subscribe(message => {
                if (isEnvironmentStartMessage(message)) {
                    resolve();
                }
            });
        });
        remoteNodeEnvironment.postMessage({
            id: 'start',
            envName,
            data: {
                environment,
                featureMapping,
                featureName,
                configName,
                projectPath: projectDirectoryPath
            }
        });
        await startMessage;
        return {
            close: () => {
                return new Promise<void>(resolve => {
                    remoteNodeEnvironment.subscribe(message => {
                        if (message.id === 'close') {
                            resolve();
                        }
                    });
                    remoteNodeEnvironment.postMessage({ id: 'close', envName });
                });
            }
        };
    }
}
