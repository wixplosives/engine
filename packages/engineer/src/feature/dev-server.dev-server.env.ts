import type io from 'socket.io';
import devServerFeature, { devServerEnv } from './dev-server.feature';
import { TargetApplication } from '../application-proxy-service';
import express from 'express';
import {
    ensureTopLevelConfigMiddleware,
    createCommunicationMiddleware,
    createLiveConfigsMiddleware,
    createConfigMiddleware,
    createFeaturesEngineRouter,
    getExternalFeaturesMetadata,
    launchHttpServer,
    NodeEnvironmentsManager,
    EXTERNAL_FEATURES_BASE_URI,
    getExportedEnvironments,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import webpackDevMiddleware from 'webpack-dev-middleware';
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

const attachWSHost = (socketServer: io.Server, envName: string, communication: Communication) => {
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
            socketServerOptions = {},
            webpackConfigPath,
        } = devServerConfig;
        const application = new TargetApplication({ basePath, nodeEnvironmentsMode, outputPath, featureDiscoveryRoot });
        const disposables = createDisposables();

        onDispose(disposables.dispose);

        run(async () => {
            // Should engine config be part of the dev experience of the engine????
            const engineConfig = await application.getEngineConfig();

            const {
                externalFeatureDefinitions = [],
                require,
                socketServerOptions: configServerOptions = {},
                externalFeaturesPath: configExternalFeaturesPath,
                serveStatic = [],
            } = engineConfig ?? {};
            if (require) {
                await application.importModules(require);
            }
            const resolvedSocketServerOptions: Partial<io.ServerOptions> = {
                ...socketServerOptions,
                ...configServerOptions,
            };
            const externalFeaturesPath = resolve(
                providedExternalFeaturesPath ?? configExternalFeaturesPath ?? join(basePath, 'node_modules')
            );
            externalFeatureDefinitions.push(...providedExternalDefinitions);
            const { port: actualPort, app, close, socketServer } = await launchHttpServer({
                staticDirPath: application.outputPath,
                httpServerPort,
                socketServerOptions: resolvedSocketServerOptions,
            });
            disposables.add(close);

            // we need to switch hosts because we can only attach a WS host after we have a socket server
            // So we launch with a basehost and upgrade to a wshost
            attachWSHost(socketServer, devServerEnv.env, communication);

            const { features, configurations, packages } = application.getFeatures(singleFeature, featureName);

            const externalFeatures = getExternalFeaturesMetadata(externalFeatureDefinitions, externalFeaturesPath);

            //Node environment manager, need to add self to the topology, I thing starting the server and the NEM should happen in the setup and not in the run
            // So potential dependencies can rely on them in the topology
            application.setNodeEnvManager(
                new NodeEnvironmentsManager(
                    socketServer,
                    {
                        configurations,
                        features,
                        defaultRuntimeOptions,
                        port: actualPort,
                        inspect,
                        overrideConfig,
                        externalFeatures,
                    },
                    resolvedSocketServerOptions
                )
            );

            disposables.add(() => application.getNodeEnvManager()?.closeAll());

            if (serveExternalFeaturesPath) {
                serveStatic.push({
                    route: `/${EXTERNAL_FEATURES_BASE_URI}`,
                    directoryPath: externalFeaturesPath,
                });
                for (const { packageName, packagePath } of externalFeatureDefinitions) {
                    if (packagePath) {
                        serveStatic.push({
                            route: `/${EXTERNAL_FEATURES_BASE_URI}/${packageName}`,
                            directoryPath: resolve(packagePath),
                        });
                    }
                }
            }

            if (serveStatic.length) {
                for (const { route, directoryPath } of serveStatic) {
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
                isExternal: false,
                externalFeatures,
                webpackConfigPath,
                useLocalExtenalFeaturesMapping: false,
                environments: getResolvedEnvironments({
                    featureName,
                    features,
                    filterContexts: singleFeature,
                    environments: [...getExportedEnvironments(features)],
                }),
            });

            for (const childCompiler of compiler.compilers) {
                if (singleRun) {
                    // This hack is to squeeze some more performance, because we can server the output in memory
                    // It was once a crash, which is no longer relevant
                    childCompiler.watch = singleRunWatchFunction(childCompiler);
                }
                const devMiddleware = webpackDevMiddleware(childCompiler);
                disposables.add(
                    () => new Promise<void>((res) => devMiddleware.close(res))
                );
                app.use(devMiddleware);
            }

            await new Promise((resolve) => {
                compiler.hooks.done.tap('compiled', resolve);
            });

            const featureEnvDefinitions = application.getFeatureEnvDefinitions(features, configurations);

            app.use(
                '/engine-feature',
                createFeaturesEngineRouter(application.getOverrideConfigsMap(), application.getNodeEnvManager()!)
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
                });
            }

            /* creating new compilers for the engineering config for 2 reasons
             *  1. de-couple the engineering build and the users application build
             *  For example it's very likely that later down the line we will never watch here
             *  but we will keep on watching on the users applicatino
             *  2. the createCompiler function is not extendable with more configs with the current API
             */
            const engineerCompilers = webpack([...engineerWebpackConfigs]);
            for (const childCompiler of engineerCompilers.compilers) {
                const devMiddleware = webpackDevMiddleware(childCompiler);
                disposables.add(
                    () => new Promise<void>((res) => devMiddleware.close(res))
                );
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
