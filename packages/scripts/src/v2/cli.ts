import express from 'express';
import esbuild from 'esbuild';
import { ENGINE_CONFIG_FILE_NAME } from '../build-constants';
import { EngineConfig } from '../types';
import { loadConfigFile } from './load-config-file';
import { RouteMiddleware, launchServer } from './start-dev-server';
import { importModules } from './import-modules';
import { analyzeFeatures } from '../analyze-feature';
import { getResolvedEnvironments } from '../utils/environments';
import { getExportedEnvironments } from '../application/utils';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { nodeFs } from '@file-services/node';
import { join } from 'node:path';

async function engineStart(rootDir: string = process.cwd()) {
    const outputPath = 'dist-web';
    const publicPath = '';
    const singleFeature = false;
    const featureName = '';
    const httpServerPort = 3000;
    const configLoaderRequest = '@wixc3/engine-scripts/dist/default-config-loader';

    const {
        buildPlugins = [],
        serveStatic = [],
        featureDiscoveryRoot = '.',
        socketServerOptions,
        require = [],
    } = (await loadConfigFile<EngineConfig>(rootDir, ENGINE_CONFIG_FILE_NAME)).config;

    await importModules(rootDir, require);

    const { features, configurations } = analyzeFeatures(nodeFs, rootDir, featureDiscoveryRoot);

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: singleFeature,
        environments: [...getExportedEnvironments(features)],
    });

    const buildConfigurations = createEnvironmentsBuildConfiguration({
        buildPlugins,
        config: [],
        configurations,
        features,
        environments,
        publicPath,
        configLoaderRequest,
    });
    const esbuildContext = await esbuild.context(buildConfigurations.webConfig);
    await esbuildContext.watch();

    serveStatic.push({
        route: '/',
        directoryPath: outputPath,
    });
    const staticMiddlewares = serveStatic?.map(({ route, directoryPath }) => ({
        path: route,
        handlers: express.static(directoryPath),
    }));

    const devMiddlewares: RouteMiddleware[] = [
        {
            path: '/engine-portal',
            handlers: (req, res) => {
                res.sendFile(join(__dirname, '..', 'engine-portal', 'index.html'));
            },
        },
    ];

    const { port } = await launchServer({
        httpServerPort,
        socketServerOptions,
        middlewares: [...devMiddlewares, ...staticMiddlewares],
    });

    console.log(`Engine server listening on port ${port}`);

    // const nodeEnvironmentManager = new NodeEnvironmentsManager(
    //     socketServer,
    //     {
    //         features: this.remapManifestFeaturePaths(manifestFeatures),
    //         port,
    //         bundlePath: this.outputPath,
    //         defaultRuntimeOptions,
    //         inspect,
    //         overrideConfig: config,
    //         configurations,
    //         requiredPaths,
    //     },
    //     this.basePath,
    //     { ...socketServerOptions, ...configSocketServerOptions }
    // );
}

engineStart().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
