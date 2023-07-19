import fs from '@file-services/node';
import { ENGINE_CONFIG_FILE_NAME, EngineConfig, analyzeFeatures, getResolvedEnvironments } from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import express from 'express';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { importModules } from './import-modules';
import { loadConfigFile } from './load-config-file';
import { RouteMiddleware, launchServer } from './start-dev-server';
import { rm } from 'node:fs/promises';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';

export type Options = {
    dev?: {
        enabled?: boolean;
        buildTargets: 'node' | 'web' | 'both';
        clean: boolean;
    };
    rootDir?: string;
    outputPath?: string;
    publicPath?: string;
    featureName?: string;
    configName?: string;
    singleFeature?: boolean;
    httpServerPort?: number;
};
export async function engineBuild({
    dev = { enabled: false, buildTargets: 'both', clean: true },
    rootDir = process.cwd(),
    outputPath = 'dist-engine',
    publicPath = '',
    featureName = '',
    configName = '',
    singleFeature = false,
    httpServerPort = 5555,
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
        dev: dev.enabled || false,
        buildPlugins,
        config: [],
        configurations,
        features,
        environments,
        publicPath,
        outputPath,
        featureName,
        configName,
    });

    await rm(outputPath, { recursive: true, force: true });

    if (dev.enabled) {
        await runDevServices({
            featureName,
            configName,
            buildConfigurations,
            serveStatic,
            httpServerPort,
            outputPath,
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
    httpServerPort: number;
    outputPath: string;
    featureName: string;
    configName: string;
    socketServerOptions: EngineConfig['socketServerOptions'];
};

async function runDevServices({
    buildConfigurations,
    serveStatic,
    httpServerPort,
    outputPath,
    featureName,
    configName,
    socketServerOptions,
}: DevServicesOptions) {
    // start web compilation
    const esbuildContextWeb = await esbuild.context(buildConfigurations.webConfig);
    await esbuildContextWeb.watch();

    // start node compilation
    const { buildEndPlugin, waitForBuildEnd } = createBuildEndPluginHook();
    buildConfigurations.nodeConfig.plugins.push(buildEndPlugin);
    const esbuildContextNode = await esbuild.context(buildConfigurations.nodeConfig);
    await esbuildContextNode.watch();

    console.log('Waiting for node build end...');
    await waitForBuildEnd();

    // start dev server
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

    console.log(`Engine dev server listening on port ${port}`);

    // start node environment manager
    fork(
        join(outputPath, 'node', `engine-environment-manager.mjs`),
        [`--applicationPath=${join(outputPath, 'web')}`, `--feature=${featureName}`, `--config=${configName}`],

        {
            execArgv: process.execArgv.concat(['--watch']),
            stdio: 'inherit',
        }
    );
}
