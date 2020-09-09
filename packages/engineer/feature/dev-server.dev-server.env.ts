import devServerFeature, { devServerEnv } from './dev-server.feature';
import { launchHttpServer, NodeEnvironmentsManager } from '@wixc3/engine-scripts';
import { ApplicationProxyService } from '../src/application-proxy-service';
import express from 'express';
import {
    ensureTopLevelConfigMiddleware,
    createCommunicationMiddleware,
    createLiveConfigsMiddleware,
    createConfigMiddleware,
    OverrideConfig,
} from '@wixc3/engine-scripts/src/config-middleware';
import WebpackDevMiddleware from 'webpack-dev-middleware';
import { createFeaturesEngineRouter } from '@wixc3/engine-scripts/src/engine-router';
import webpack from 'webpack';

import { WsServerHost } from '@wixc3/engine-core-node/src';

devServerFeature.setup(
    devServerEnv,
    (
        {
            run,
            devServerConfig: {
                httpServerPort,
                featureName,
                singleFeature,
                publicConfigsRoute,
                title,
                publicPath,
                configName,
                singleRun,
                inspect,
                autoLaunch,
                nodeEnvironmentsMode,
                basePath,
                mode,
                overrideConfig,
                defaultRuntimeOptions,
            },
            engineerWebpackConfigs,
            serverListeningHandlerSlot,
        },
        { COM: { communication } }
    ) => {
        const application = new ApplicationProxyService({ basePath });
        const overrideConfigsMap = new Map<string, OverrideConfig>();
        const disposables = new Set<() => unknown>();
        let nodeEnvManager: NodeEnvironmentsManager | null = null;

        const getNodeEnvManager = () => nodeEnvManager;

        const close = async () => {
            for (const dispose of disposables) {
                await dispose();
            }
            disposables.clear();
        };

        run(async () => {
            // Should engine config be part of the dev experience of the engine????
            const engineConfig = await application.getEngineConfig();
            if (engineConfig && engineConfig.require) {
                await application.importModules(engineConfig.require);
            }

            const { port, app, close, socketServer } = await launchHttpServer({
                staticDirPath: application.outputPath,
                httpServerPort,
            });
            disposables.add(() => close());

            const host = new WsServerHost(socketServer.of('/build'));

            communication.clearEnvironment(devServerEnv.env);
            communication.registerMessageHandler(host);
            communication.registerEnv(devServerEnv.env, host);

            const { features, configurations, packages } = application.analyzeFeatures();
            if (singleFeature && featureName) {
                application.filterByFeatureName(features, featureName);
            }

            const compiler = application.createCompiler({
                mode,
                features,
                featureName,
                configName,
                publicPath,
                title,
                configurations,
                staticBuild: false,
                publicConfigsRoute,
                overrideConfig,
                singleFeature,
            });

            // This hack is to squeeze some more performance, because we can server the output in memory
            // It was once a crash, which is no longer relevant
            if (singleRun) {
                for (const childCompiler of compiler.compilers) {
                    childCompiler.watch = function watch(_watchOptions, handler) {
                        childCompiler.run(handler);
                        return {
                            close(cb) {
                                if (cb) {
                                    cb();
                                }
                            },
                            invalidate: () => undefined,
                        };
                    };
                }
            }

            //Node environment manager, need to add self to the topology, I thing starting the server and the NEM should happen in the setup and not in the run
            // So potential dependants can rely on them in the topology
            const nodeEnvironmentManager = new NodeEnvironmentsManager(socketServer, {
                configurations,
                features,
                defaultRuntimeOptions,
                port,
                inspect,
                overrideConfig,
            });
            nodeEnvManager = nodeEnvironmentManager;
            disposables.add(() => nodeEnvironmentManager?.closeAll());

            if (engineConfig && engineConfig.serveStatic) {
                for (const { route, directoryPath } of engineConfig.serveStatic) {
                    app.use(route, express.static(directoryPath));
                }
            }

            const topologyOverrides = (featureName: string): Record<string, string> | undefined =>
                featureName.indexOf('engineer/') === 0
                    ? {
                          [devServerEnv.env]: `http://localhost:${port}/${devServerEnv.env}`,
                      }
                    : undefined;

            app.use(`/${publicConfigsRoute}`, [
                // WTF need to look into
                ensureTopLevelConfigMiddleware,
                // I think this is irrelevant, apps should handle their own communication, I shouldn't do it for them
                createCommunicationMiddleware(nodeEnvironmentManager, publicPath, topologyOverrides),
                // WTF?
                createLiveConfigsMiddleware(configurations, basePath, overrideConfigsMap),

                // WTF?
                createConfigMiddleware(overrideConfig),
            ]);

            // Write middleware for each of the apps
            for (const childCompiler of compiler.compilers) {
                const devMiddleware = WebpackDevMiddleware(childCompiler, {
                    publicPath: '/',
                    logLevel: 'silent',
                });
                disposables.add(() => new Promise((res) => devMiddleware.close(res)));
                app.use(devMiddleware);
            }

            // Why would I run this script when the compiler is done?
            await new Promise((resolve) => {
                compiler.hooks.done.tap('engine-scripts init', resolve);
            });

            const featureEnvDefinitions = application.getFeatureEnvDefinitions(features, configurations);

            const mainUrl = `http://localhost:${httpServerPort}/`;
            if (packages.length === 1) {
                // print links to features
                console.log('Available Configurations:');
                for (const { configurations, featureName } of Object.values(featureEnvDefinitions)) {
                    for (const runningConfigName of configurations) {
                        console.log(`${mainUrl}main.html?feature=${featureName}&config=${runningConfigName}`);
                    }
                }
            }

            app.use('/engine-feature', createFeaturesEngineRouter(overrideConfigsMap, nodeEnvironmentManager));

            app.get('/engine-state', (_req, res) => {
                res.json({
                    result: 'success',
                    data: {
                        features: featureEnvDefinitions,
                        featuresWithRunningNodeEnvs: nodeEnvironmentManager?.getFeaturesWithRunningEnvironments(),
                    },
                });
            });

            if (autoLaunch && featureName) {
                await nodeEnvironmentManager.runServerEnvironments({
                    featureName,
                    configName,
                    overrideConfigsMap,
                    mode: nodeEnvironmentsMode,
                });
            }

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
                await handler();
            }
        });
        return { application, getNodeEnvManager, overrideConfigsMap, close };
    }
);
