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

import { IEnvironment, loadFeaturesFromPackages } from './analyze-feature';
import { createBundleConfig, envTypeToBundleTarget } from './create-bundle-config';
import { createEntrypoints } from './create-entrypoints';
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

    public async build(featureName: string, configName?: string): Promise<webpack.Stats> {
        throw new Error(`TODO: implement build. ${featureName} - ${configName}.`);
    }

    public async start({  }: IStartOptions = {}) {
        const { basePath } = this;
        console.time(`Analyzing Features.`);
        const packages = resolvePackages(basePath);
        const { features, configurations } = loadFeaturesFromPackages(packages, fs);
        console.timeEnd('Analyzing Features.');

        const allExportedEnvs: IEnvironment[] = [];
        for (const { exportedEnvs } of features.values()) {
            allExportedEnvs.push(...exportedEnvs);
        }
        const nodeEnvs = allExportedEnvs.filter(({ type }) => type === 'node');
        const nonNodeEnvs = allExportedEnvs.filter(({ type }) => type !== 'node');

        const app = express();
        const { port, httpServer } = await safeListeningHttpServer(3000, app);
        app.use('/favicon.ico', noContentHandler);
        app.use('/config', async (req, res, next) => {
            const configName = req.path.slice(1);
            const configFilePath = configurations.get(configName);
            if (!configFilePath) {
                next();
            } else {
                const { default: configValue } = await import(configFilePath);
                res.send(configValue);
            }
        });

        const webpackConfigs = nonNodeEnvs.map(({ name: envName, type }) =>
            createBundleConfig({
                context: basePath,
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
        hookMultiCompilerStats(multiCompiler);

        const devMiddlewares: webpackDevMiddleware.WebpackDevMiddleware[] = [];
        for (const compiler of multiCompiler.compilers) {
            const devMiddleware = webpackDevMiddleware(compiler, { publicPath: '/', logLevel: 'silent' });
            devMiddlewares.push(devMiddleware);
            app.use(devMiddleware);
        }

        await new Promise(resolve => {
            multiCompiler.hooks.done.tap('engine-scripts init', resolve);
        });

        // print links to features
        // const configLinks = this.getRootURLS(environments, featureMapping, port);
        // const engineDev = engineDevMiddleware(features, environments, configLinks);
        // app.use(engineDev);

        console.log(`Listening:`);
        console.log(`http://localhost:${port}/`);
        const socketServer = io(httpServer);

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
        return {
            port,
            httpServer,
            runFeature,
            async close() {
                for (const devMiddleware of devMiddlewares) {
                    await new Promise(res => devMiddleware.close(res));
                }
                await new Promise(res => socketServer.close(res));
            }
        };
    }
}

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

function hookMultiCompilerStats(compiler: webpack.MultiCompiler): void {
    compiler.hooks.watchRun.tap('engine-scripts', () => {
        console.log('Bundling using webpack...');
    });

    compiler.hooks.done.tap('engine-scripts stats printing', ({ stats }) => {
        const statsWithMessages = stats.filter(s => s.hasErrors() || s.hasWarnings());
        if (statsWithMessages.length) {
            console.log(statsWithMessages.map(s => s.toString()).join('\n'));
        }
        console.log('Done bundling.');
    });
}
