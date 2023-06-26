import fs from '@file-services/node';
import { ENGINE_CONFIG_FILE_NAME, EngineConfig, analyzeFeatures, getResolvedEnvironments } from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import express from 'express';
import { join } from 'node:path';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { importModules } from './import-modules';
import { loadConfigFile } from './load-config-file';
import { RouteMiddleware, launchServer } from './start-dev-server';
import { rm } from 'node:fs/promises';

export type Options = {
    dev?: {
        enabled?: boolean;
        buildTargets: 'node' | 'web' | 'both';
    };
    rootDir?: string;
    outputPath?: string;
    publicPath?: string;
    featureName?: string;
    singleFeature?: boolean;
    httpServerPort?: number;
};

async function engineStart({
    dev = { enabled: false, buildTargets: 'both' },
    rootDir = process.cwd(),
    outputPath = 'dist-web',
    publicPath = '',
    featureName = '',
    singleFeature = false,
    httpServerPort = 3000,
}: Options = {}) {
    const {
        buildPlugins = [],
        serveStatic = [],
        featureDiscoveryRoot = '.',
        socketServerOptions,
        require: requiredPaths = [],
    } = (await loadConfigFile<EngineConfig>(rootDir, ENGINE_CONFIG_FILE_NAME)).config;

    await importModules(rootDir, requiredPaths);

    const { features, configurations } = analyzeFeatures(
        fs,
        rootDir,
        featureDiscoveryRoot,
        singleFeature ? featureName : undefined
    );

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: singleFeature,
    });

    const buildConfigurations = createEnvironmentsBuildConfiguration({
        buildPlugins,
        config: [],
        configurations,
        features,
        environments,
        publicPath,
    });
    await rm('dist-web', { recursive: true, force: true });
    await rm('dist-node', { recursive: true, force: true });

    if (dev.enabled) {
        await runDevServices({
            buildConfigurations,
            serveStatic,
            outputPath,
            rootDir,
            httpServerPort,
            socketServerOptions,
        });
    } else {
        const start = performance.now();
        await Promise.all([
            dev.buildTargets === 'node' || dev.buildTargets === 'both'
                ? esbuild.build(buildConfigurations.nodeConfig)
                : Promise.resolve(),
            dev.buildTargets === 'web' || dev.buildTargets === 'both'
                ? esbuild.build(buildConfigurations.webConfig)
                : Promise.resolve(),
        ]);
        const end = performance.now();
        console.log(`Build total ${Math.round(end - start)}ms`);
    }
}

type DevServicesOptions = {
    buildConfigurations: ReturnType<typeof createEnvironmentsBuildConfiguration>;
    serveStatic: Required<EngineConfig>['serveStatic'];
    outputPath: string;
    rootDir: string;
    httpServerPort: number;
    socketServerOptions: EngineConfig['socketServerOptions'];
};

async function runDevServices({
    buildConfigurations,
    serveStatic,
    outputPath,
    rootDir,
    httpServerPort,
    socketServerOptions,
}: DevServicesOptions) {
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
        {
            path: '/configs/:featureName/:environmentName',
            handlers: (req, res) => {
                const { featureName, environmentName } = req.params;
                const path = `${outputPath}/configs/${featureName}/${
                    environmentName?.endsWith('.json') ? environmentName : `${environmentName}.json`
                }`;
                res.sendFile(join(rootDir, path));
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
    //         bundlePath: outputPath,
    //         defaultRuntimeOptions,
    //         // inspect,
    //         // overrideConfig: config,
    //         configurations,
    //         requiredPaths,
    //     },
    //     basePath,
    //     { ...socketServerOptions, ...configSocketServerOptions }
    // );
}

engineStart({ dev: { enabled: false, buildTargets: 'node' } }).catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
