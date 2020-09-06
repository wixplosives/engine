import buildFeature, { buildEnv } from './build.feature';
import {
    launchHttpServer,
    TopLevelConfigProvider,
    NodeEnvironmentsManager,
    LaunchEnvironmentMode,
} from '@wixc3/engine-scripts/src';
import { ApplicationProxyService } from '../src/application-proxy-service';
import { cwd } from 'process';
import type { TopLevelConfig } from '@wixc3/engine-core/src';
import express from 'express';
import {
    ensureTopLevelConfigMiddleware,
    createCommunicationMiddleware,
    createLiveConfigsMiddleware,
    createConfigMiddleware,
} from '@wixc3/engine-scripts/src/config-middleware';
import WebpackDevMiddleware from 'webpack-dev-middleware';
import { createFeaturesEngineRouter } from '@wixc3/engine-scripts/src/engine-router';

buildFeature.setup(buildEnv, ({ run }) => {
    const basePath = cwd();
    const application = new ApplicationProxyService({ basePath });
    const httpServerPort = 3000;
    const singleFeature = false;
    const featureName: string | undefined = undefined;
    const configName = undefined;
    const publicPath = undefined;
    const title = undefined;
    const publicConfigsRoute = 'configs/';
    const overrideConfig: TopLevelConfig | TopLevelConfigProvider = [];
    const singleRun = false;
    const defaultRuntimeOptions = {};
    const inspect = false;
    const autoLaunch = false;
    const nodeEnvironmentsMode: LaunchEnvironmentMode = 'same-server';

    // Currently we rely on mode === 'development' within the createCompiler funciton
    // To push the dashboard into the bundeld scripts
    // We want to push it via a slot, so we will start will pushing it into the compiler before
    // running it, thus decoupling it from the flag and making it customizable from the outside
    // Eventually via the gui feature which will pass the entry point via a slot,
    // Maybe someday in the future it will just be compiled once and served, without the devserver
    const mode = 'production';
    run(async () => {
        // Should engine config be part of the dev experience of the engine????
        const engineConfig = await application.getEngineConfig();
        if (engineConfig && engineConfig.require) {
            await application.importModules(engineConfig.require);
        }
        const disposables = new Set<() => unknown>();
        const { port, app, close, socketServer } = await launchHttpServer({
            staticDirPath: application.outputPath,
            httpServerPort,
        });
        disposables.add(() => close());

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

        // Cold run, not sure I want this here
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
        disposables.add(() => nodeEnvironmentManager.closeAll());

        const overrideConfigsMap = new Map<string, OverrideConfig>();
        if (engineConfig && engineConfig.serveStatic) {
            for (const { route, directoryPath } of engineConfig.serveStatic) {
                app.use(route, express.static(directoryPath));
            }
        }

        app.use(`/${publicConfigsRoute}`, [
            // WTF need to look into
            ensureTopLevelConfigMiddleware,
            // I think this is irrelevant, apps should handle their own communication, I shouldn't do it for them
            createCommunicationMiddleware(nodeEnvironmentManager, publicPath),
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

        // This doesn't belong here, it should be part of the dashboard feature
        const mainUrl = `http://localhost:${port}/`;
        console.log(`Listening:`);
        console.log('Dashboard URL: ', mainUrl);
        if (featureName) {
            console.log('Main application URL: ', `${mainUrl}main.html`);
        }

        const featureEnvDefinitions = application.getFeatureEnvDefinitions(features, configurations);

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
                    featuresWithRunningNodeEnvs: nodeEnvironmentManager.getFeaturesWithRunningEnvironments(),
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
    });
    return { application };
});
