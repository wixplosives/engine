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
import webpack from 'webpack';
import { WsServerHost } from '@wixc3/engine-core-node';
import { dirname, resolve } from 'path';
import { Communication, createDisposables } from '@wixc3/engine-core';
import { buildFeatureLinks } from '../feature-dependency-graph';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpackDevMiddleware = require('webpack-dev-middleware') as (
    compiler: webpack.MultiCompiler,
    options?: { index?: string }
) => WebpackDevMiddleware;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpackHotMiddleware = require('webpack-hot-middleware') as (
    compiler: webpack.MultiCompiler
) => WebpackHotMiddleware;

interface WebpackDevMiddleware extends express.Handler {
    close(cb?: () => void): void;
    waitUntilValid(cb: () => void): void;
}
interface WebpackHotMiddleware extends express.Handler {
    close(cb?: () => void): void;
}

const attachWSHost = (socketServer: io.Server, envName: string, communication: Communication) => {
    const host = new WsServerHost(socketServer.of(`/${envName}`));
    communication.clearEnvironment(envName);
    communication.registerMessageHandler(host);
    communication.registerEnv(envName, host);
    return () => {
        communication.clearEnvironment(envName);
    };
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
            inspect,
            mode,
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
            externalFeaturesRoute,
            webpackHot = false,
        } = devServerConfig;
        const application = new TargetApplication({ basePath, outputPath, featureDiscoveryRoot });
        const disposables = createDisposables();

        onDispose(disposables.dispose);

        run(async () => {
            // Should engine config be part of the dev experience of the engine????
            const { config: engineConfig, path: engineConfigPath } = await application.getEngineConfig();

            const {
                externalFeatureDefinitions = [],
                require,
                socketServerOptions: configServerOptions = {},
                externalFeaturesBasePath: configExternalFeaturesPath,
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
                providedExternalFeaturesPath ?? (configExternalFeaturesPath ? dirname(engineConfigPath!) : basePath)
            );

            externalFeatureDefinitions.push(...providedExternalDefinitions);

            const fixedExternalFeatureDefinitions = application.normilizeDefinitionsPackagePath(
                externalFeatureDefinitions,
                providedExternalFeaturesPath,
                configExternalFeaturesPath,
                engineConfigPath
            );
            const {
                port: actualPort,
                app,
                close,
                socketServer,
            } = await launchHttpServer({
                staticDirPath: application.outputPath,
                httpServerPort,
                socketServerOptions: resolvedSocketServerOptions,
            });
            disposables.add(close);

            // we need to switch hosts because we can only attach a WS host after we have a socket server
            // So we launch with a basehost and upgrade to a wshost
            attachWSHost(socketServer, devServerEnv.env, communication);

            const { features, configurations, packages } = application.getFeatures(singleFeature, featureName);
            const externalFeatures = getExternalFeaturesMetadata(fixedExternalFeatureDefinitions, externalFeaturesPath);

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
                    basePath,
                    resolvedSocketServerOptions
                ),
                nodeEnvironmentsMode || engineConfig?.nodeEnvironmentsMode
            );

            disposables.add(() => application.getNodeEnvManager()?.closeAll());

            if (serveExternalFeaturesPath) {
                for (const { packageName, packagePath } of fixedExternalFeatureDefinitions) {
                    if (packagePath) {
                        serveStatic.push({
                            route: `/${EXTERNAL_FEATURES_BASE_URI}/${packageName}`,
                            directoryPath: resolve(
                                engineConfigPath ? dirname(engineConfigPath) : basePath,
                                packagePath
                            ),
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

            app.get('/feature-graph', (req, res) => {
                const featureName = req.query['feature-name'] as string;
                const { links, nodes } = buildFeatureLinks(features.get(featureName)!.exportedFeature);

                const graph = {
                    nodes,
                    links,
                };
                res.json(graph);
            });

            app.get(externalFeaturesRoute, (_, res) => {
                res.json(externalFeatures);
            });

            // Write middleware for each of the apps
            const { compiler, dispose: disposeCompiler } = application.createCompiler({
                ...devServerConfig,
                features,
                staticBuild: false,
                mode,
                configurations,
                isExternal: false,
                webpackConfigPath,
                environments: getResolvedEnvironments({
                    featureName,
                    features,
                    filterContexts: singleFeature,
                    environments: [...getExportedEnvironments(features)],
                }),
                externalFeaturesRoute,
            });

            const compilationPromises: Promise<void>[] = [];

            if (compiler.compilers.length > 0) {
                const devMiddleware = webpackDevMiddleware(compiler);
                disposables.add(() => new Promise<void>((res) => devMiddleware.close(res)));
                app.use(devMiddleware);
                compilationPromises.push(
                    new Promise<void>((resolve) => {
                        devMiddleware.waitUntilValid(() => resolve());
                    })
                );
                if (webpackHot) {
                    const hotMiddleware = webpackHotMiddleware(compiler);
                    disposables.add(hotMiddleware.close);
                    app.use(hotMiddleware);
                }
            }

            disposables.add(disposeCompiler);

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
            if (engineerCompilers.compilers.length > 0) {
                // This assumes we have only one engineer config - for the dashboard
                // If we decide to create more engineers one day we might need to rethink the index file
                // In any case it's a fallback, full paths should still work as usual
                const engineerDevMiddleware = webpackDevMiddleware(engineerCompilers, { index: 'main-dashboard.html' });
                disposables.add(() => new Promise<void>((res) => engineerDevMiddleware.close(res)));
                app.use(engineerDevMiddleware);
                compilationPromises.push(
                    new Promise<void>((resolve) => {
                        engineerDevMiddleware.waitUntilValid(() => resolve());
                    })
                );
            }

            await Promise.all(compilationPromises);

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

            for (const handler of serverListeningHandlerSlot) {
                await handler({ port: actualPort, host: 'localhost', router: app });
            }
        });
        return {
            application,
            devServerActions: { close: disposables.dispose },
        };
    }
);
