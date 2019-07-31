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
import VirtualModulesPlugin from 'webpack-virtual-modules';

import { IEnvironment, IFeatureDefinition, loadFeaturesFromPackages } from './analyze-feature';
import { createEntrypoints } from './create-entrypoints';
import { createBundleConfig, envTypeToBundleTarget } from './create-webpack-config';
import { engineDevMiddleware } from './engine-start-app/engine-dev-middlewere';
import { runNodeEnvironments } from './run-node-environments';
import { resolvePackages } from './utils/resolve-packages';

const rimraf = promisify(rimrafCb);

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

    public async build(_featureName: string, _configName?: string): Promise<webpack.Stats> {
        const { features, configurations } = this.analyzeFeatures();

        const { multiCompiler } = this.createBundler(features, configurations);

        return new Promise<webpack.Stats>((resolve, reject) =>
            multiCompiler.run((e, s) => (e || s.hasErrors() ? reject(e || new Error(s.toString())) : resolve(s)))
        );
    }

    public async start({  }: IStartOptions = {}) {
        const { features, configurations, packages } = this.analyzeFeatures();

        const { multiCompiler, nodeEnvs } = this.createBundler(features, configurations);

        const app = express();

        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        const socketServer = io(httpServer);

        app.use('/favicon.ico', noContentHandler);
        app.use('/config', async (req, res) => {
            const configName = req.path.slice(1);
            const configFilePath = configurations.get(configName);
            if (!configFilePath) {
                const configNames = Object.keys(configurations).join(', ');
                throw new Error(`cannot find config named "${configName}". available configs: ${configNames}`);
            }
            const { default: configValue } = await import(configFilePath);
            res.send(configValue);
        });

        const devMiddlewares: webpackDevMiddleware.WebpackDevMiddleware[] = [];
        for (const compiler of multiCompiler.compilers) {
            const devMiddleware = webpackDevMiddleware(compiler, { publicPath: '/', logLevel: 'silent' });
            devMiddlewares.push(devMiddleware);
            app.use(devMiddleware);
        }

        await new Promise(resolve => {
            multiCompiler.hooks.done.tap('engine-scripts init', resolve);
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

        const runFeature = async ({ featureName, configName, projectPath }: IFeatureTarget) => {
            projectPath = fs.resolve(projectPath || '');

            const environmentServer = await runNodeEnvironments({
                socketServer,
                features,
                configurations,
                environments: nodeEnvs,
                featureName,
                configName,
                projectPath
            });

            return {
                close: async () => {
                    await environmentServer.dispose();
                }
            };
        };

        const engineDev = engineDevMiddleware({
            runningFeaturesAndConfigs,
            mainUrl,
            runFeature
        });
        app.use(engineDev);

        return {
            port,
            httpServer,
            runFeature,
            async close() {
                await new Promise(res => socketServer.close(res));
                for (const devMiddleware of devMiddlewares) {
                    await new Promise(res => devMiddleware.close(res));
                }
                devMiddlewares.length = 0;
            }
        };
    }

    private createBundler(features: Map<string, IFeatureDefinition>, configurations: Map<string, string>) {
        const { basePath, outputPath } = this;
        const allExportedEnvs: IEnvironment[] = [];
        for (const { exportedEnvs } of features.values()) {
            allExportedEnvs.push(...exportedEnvs);
        }
        const nodeEnvs = allExportedEnvs.filter(({ type }) => type === 'node');
        const nonNodeEnvs = allExportedEnvs.filter(({ type }) => type !== 'node');

        const webpackConfigs = nonNodeEnvs.map(({ name: envName, type }) =>
            createBundleConfig({
                context: basePath,
                outputPath,
                entryName: envName,
                entryPath: fs.join(basePath, `${envName}-${type}-entry.js`),
                target: envTypeToBundleTarget(type),
                plugins: [
                    new VirtualModulesPlugin(
                        createEntrypoints({ environments: nonNodeEnvs, basePath, features, configs: configurations })
                    )
                ]
            })
        );
        const multiCompiler = webpack(webpackConfigs);
        hookCompilerToConsole(multiCompiler);
        return { multiCompiler, nodeEnvs };
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

function hookCompilerToConsole(compiler: webpack.MultiCompiler): void {
    const bundleStartMessage = () => console.log('Bundling using webpack...');

    compiler.hooks.run.tap('engine-scripts', bundleStartMessage);
    compiler.hooks.watchRun.tap('engine-scripts', bundleStartMessage);

    compiler.hooks.done.tap('engine-scripts stats printing', ({ stats }) => {
        const statsWithMessages = stats.filter(s => s.hasErrors() || s.hasWarnings());
        if (statsWithMessages.length) {
            console.log(statsWithMessages.map(s => s.toString()).join('\n'));
        }
        console.log('Done bundling.');
    });
}
