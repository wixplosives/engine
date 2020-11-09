import devServerFeature, { devServerEnv } from './dev-server.feature';
import { TargetApplication } from '../application-proxy-service';
import express from 'express';
import {
    ensureTopLevelConfigMiddleware,
    createCommunicationMiddleware,
    createLiveConfigsMiddleware,
    createConfigMiddleware,
    createFeaturesEngineRouter,
    getExternalFeatures,
    launchHttpServer,
    NodeEnvironmentsManager,
    getExportedEnvironments,
} from '@wixc3/engine-scripts';
import WebpackDevMiddleware from 'webpack-dev-middleware';
import webpack from 'webpack';
import { WsServerHost } from '@wixc3/engine-core-node';
import { join, resolve } from 'path';
import { Communication, createDisposables } from '@wixc3/engine-core';

function singleRunWatchFunction(compiler: webpack.Compiler) {
    // This custom watch optimization only compiles once, but allows us to use webpack dev server
    // and serve the output from memory
    return function watch(_: unknown, handler: webpack.ICompiler.Handler) {
        compiler.run(handler);
        return {
            close(cb?: () => void) {
                if (cb) {
                    cb();
                }
            },
            invalidate: () => undefined,
        };
    };
}

const attachWSHost = (socketServer: SocketIO.Server, envName: string, communication: Communication) => {
    const host = new WsServerHost(socketServer.of(`/${envName}`));

    communication.clearEnvironment(envName);
    communication.registerMessageHandler(host);
    communication.registerEnv(envName, host);
};

devServerFeature.setup(
    devServerEnv,
    (
        { run, devServerConfig, engineerWebpackConfigs, serverListeningHandlerSlot, onDispose },
        { COM: { communication } }
    ) => {
        const {
            httpServerPort,
            featureName,
            singleFeature,
            publicConfigsRoute,
            publicPath,
            configName,
            singleRun,
            inspect,
            autoLaunch,
            nodeEnvironmentsMode,
            basePath = process.cwd(),
            overrideConfig,
            defaultRuntimeOptions,
            outputPath,
            externalFeatureDefinitions: providedExternalDefinitions,
            externalFeaturesPath: providedExternalFeaturesPath,
            serveExternalFeaturesPath = true,
            featureDiscoveryRoot,
        } = devServerConfig;
        const application = new TargetApplication({ basePath, nodeEnvironmentsMode, outputPath, featureDiscoveryRoot });
        const disposables = createDisposables();

        onDispose(disposables.dispose);

        run(async () => {
            // Should engine config be part of the dev experience of the engine????
            const engineConfig = await application.getEngineConfig();

            const { externalFeatureDefinitions = [], require, externalFeaturesPath: configExternalFeaturesPath } =
                engineConfig ?? {};
            if (require) {
                await application.importModules(require);
            }
            const externalFeaturesPath =
                providedExternalFeaturesPath ?? configExternalFeaturesPath ?? join(basePath, 'node_modules');
            externalFeatureDefinitions.push(...providedExternalDefinitions);
            const { port: actualPort, app, close, socketServer } = await launchHttpServer({
                staticDirPath: application.outputPath,
                httpServerPort,
            });
            disposables.add(() => close());

            // we need to switch hosts because we can only attach a WS host after we have a socket server
            // So we launch with a basehost and upgrade to a wshost
            attachWSHost(socketServer, devServerEnv.env, communication);

            const { features, configurations, packages } = application.getFeatures(singleFeature, featureName);

            application.setNodeEnvManager(
                new NodeEnvironmentsManager(socketServer, {
                    configurations,
                    features,
                    defaultRuntimeOptions,
                    port: actualPort,
                    inspect,
                    overrideConfig,
                    externalFeaturesBasePath: externalFeaturesPath,
                })
            );

            disposables.add(() => application.getNodeEnvManager()?.closeAll());

            if (engineConfig?.serveStatic) {
                for (const { route, directoryPath } of engineConfig.serveStatic) {
                    app.use(route, express.static(directoryPath));
                }
            }

            const topologyOverrides = (featureName: string): Record<string, string> | undefined =>
                featureName.indexOf('engineer/') === 0
                    ? {
                          [devServerEnv.env]: `http://localhost:${actualPort}/${devServerEnv.env}`,
                      }
                    : undefined;

            app.use(`/${publicConfigsRoute}`, [
                ensureTopLevelConfigMiddleware,
                createCommunicationMiddleware(application.getNodeEnvManager()!, publicPath, topologyOverrides),
                createLiveConfigsMiddleware(configurations, basePath, application.getOverrideConfigsMap()),
                createConfigMiddleware(overrideConfig),
            ]);

            // Write middleware for each of the apps
            const compiler = application.createCompiler({
                ...devServerConfig,
                features,
                staticBuild: false,
                configurations,
                externalFeature: false,
            });

            for (const childCompiler of compiler.compilers) {
                if (singleRun) {
                    // This hack is to squeeze some more performance, because we can server the output in memory
                    // It was once a crash, which is no longer relevant
                    childCompiler.watch = singleRunWatchFunction(childCompiler);
                }
                const devMiddleware = WebpackDevMiddleware(childCompiler, {
                    publicPath: '/',
                    logLevel: 'silent',
                });
                disposables.add(() => new Promise((res) => devMiddleware.close(res)));
                app.use(devMiddleware);
            }

            await new Promise((resolve) => {
                compiler.hooks.done.tap('compiled', resolve);
            });
            if (serveExternalFeaturesPath) {
                app.use('/plugins', express.static(resolve(externalFeaturesPath)));
            }

            const externalFeatures = getExternalFeatures(
                externalFeatureDefinitions,
                [...getExportedEnvironments(features)],
                externalFeaturesPath
            );

            app.use('/external', (_, res) => {
                res.json(externalFeatures);
            });

            //Node environment manager, need to add self to the topology, I thing starting the server and the NEM should happen in the setup and not in the run
            // So potential dependants can rely on them in the topology

            const featureEnvDefinitions = application.getFeatureEnvDefinitions(features, configurations);

            app.use(
                '/engine-feature',
                createFeaturesEngineRouter(
                    application.getOverrideConfigsMap(),
                    application.getNodeEnvManager()!,
                    externalFeatureDefinitions
                )
            );

            app.get('/engine-state', (_req, res) => {
                res.json({
                    result: 'success',
                    data: {
                        features: featureEnvDefinitions,
                        featuresWithRunningNodeEnvs: application
                            .getNodeEnvManager()
                            ?.getFeaturesWithRunningEnvironments(),
                    },
                });
            });

            if (autoLaunch && featureName) {
                await application.runFeature({
                    featureName,
                    configName,
                    externalFeatureDefinitions,
                });
            }

            /* I create new compilers for the engineering config for 2 reasons
             *  1. I don't want to couple the engineering build and the users application build
             *  For example it's very likely that later down the line we will never watch here
             *  but we will keep on watching on the users applicatino
             *  2. I the createCompiler function, which I can't extend with more configs with the current API
             */
            const engineerCompilers = webpack([...engineerWebpackConfigs]);
            for (const childCompiler of engineerCompilers.compilers) {
                const devMiddleware = WebpackDevMiddleware(childCompiler, {
                    publicPath: '/',
                    logLevel: 'silent',
                });
                disposables.add(() => new Promise((res) => devMiddleware.close(res)));
                app.use(devMiddleware);
            }

            for (const handler of serverListeningHandlerSlot) {
                await handler({ port: actualPort, host: 'localhost' });
            }

            const mainUrl = `http://localhost:${actualPort}/`;
            if (featureName) {
                console.log('Main application URL:', `${mainUrl}main.html`);
            }

            if (packages.length === 1) {
                // print links to features
                console.log('Available Configurations:');
                for (const { configurations, featureName } of Object.values(featureEnvDefinitions)) {
                    for (const runningConfigName of configurations) {
                        console.log(`${mainUrl}main.html?feature=${featureName}&config=${runningConfigName}`);
                    }
                }
            }
        });
        return {
            application,
            devServerActions: { close: disposables.dispose },
        };
    }
);
