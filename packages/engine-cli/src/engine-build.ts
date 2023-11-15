import fs from '@file-services/node';
import { importModules } from '@wixc3/engine-runtime-node';
import { ENGINE_CONFIG_FILE_NAME, EngineConfig, analyzeFeatures, getResolvedEnvironments } from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import express from 'express';
import { fork } from 'node:child_process';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';
import { loadConfigFile } from './load-config-file';
import { RouteMiddleware, launchServer } from './start-dev-server';

export interface RunEngineOptions {
    verbose?: boolean;
    clean?: boolean;
    dev?: boolean;
    watch?: boolean;
    run?: boolean;
    buildTargets?: 'node' | 'web' | 'both';
    rootDir?: string;
    outputPath?: string;
    publicPath?: string;
    feature?: string;
    config?: string;
    httpServerPort?: number;
    engineConfigFilePath?: string;
    engineConfigOverride?: Partial<EngineConfig>;
}

export async function runEngine({
    verbose = false,
    clean = true,
    watch = false,
    dev = false,
    run = false,
    rootDir = process.cwd(),
    outputPath = 'dist-engine',
    publicPath = '',
    feature: featureName,
    config: configName,
    httpServerPort = 5555,
    buildTargets = 'both',
    engineConfigFilePath,
    engineConfigOverride = {},
}: RunEngineOptions = {}) {
    let esbuildContextWeb;
    let esbuildContextNode;
    let runManagerContext;

    rootDir = fs.resolve(rootDir);
    outputPath = fs.resolve(rootDir, outputPath);

    const configFilePath =
        engineConfigFilePath || (await fs.promises.findClosestFile(rootDir, ENGINE_CONFIG_FILE_NAME));
    const engineConfig: EngineConfig = configFilePath
        ? { ...((await loadConfigFile(configFilePath)) as EngineConfig), ...engineConfigOverride }
        : engineConfigOverride;

    const {
        buildPlugins = [],
        serveStatic = [],
        featureDiscoveryRoot = '.',
        socketServerOptions,
        require: requiredPaths = [],
        extensions,
        buildConditions,
    } = engineConfig;

    await importModules(rootDir, requiredPaths);

    const { features, configurations } = await analyzeFeatures(
        fs,
        rootDir,
        featureDiscoveryRoot,
        featureName,
        extensions,
        buildConditions,
    );

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: !!featureName,
        findAllEnvironments: false, // ??
    });

    const buildConfigurations = createEnvironmentsBuildConfiguration({
        dev,
        buildPlugins,
        config: [],
        configurations,
        features,
        environments,
        publicPath,
        outputPath,
        featureName,
        configName,
        extensions,
        buildConditions,
    });

    if (clean) {
        if (verbose) {
            console.log(`Cleaning ${outputPath}`);
        }
        await fs.promises.rm(outputPath, { recursive: true, force: true });
    }

    if (watch) {
        if (buildTargets === 'web' || buildTargets === 'both') {
            if (verbose) {
                console.log('Starting web compilation in watch mode');
            }
            esbuildContextWeb = await esbuild.context(buildConfigurations.webConfig);
            await esbuildContextWeb.watch();
        }

        if (buildTargets === 'node' || buildTargets === 'both') {
            if (verbose) {
                console.log('Starting node compilation in watch mode');
            }
            const { buildEndPlugin, waitForBuildEnd } = createBuildEndPluginHook();
            buildConfigurations.nodeConfig.plugins.push(buildEndPlugin);
            esbuildContextNode = await esbuild.context(buildConfigurations.nodeConfig);
            await esbuildContextNode.watch();
            if (verbose) {
                console.log('Waiting for node build end.');
            }
            await waitForBuildEnd();
        }
    } else {
        const start = performance.now();
        await Promise.all([
            buildTargets === 'node' || buildTargets === 'both'
                ? esbuild.build(buildConfigurations.nodeConfig)
                : Promise.resolve(),
            buildTargets === 'web' || buildTargets === 'both'
                ? esbuild.build(buildConfigurations.webConfig)
                : Promise.resolve(),
        ]);
        const end = performance.now();
        console.log(`Build time ${Math.round(end - start)}ms`);
    }

    if (run) {
        if (verbose) {
            console.log('Running engine');
        }
        runManagerContext = await runNodeManager({
            featureName,
            configName,
            serveStatic,
            httpServerPort,
            outputPath,
            socketServerOptions,
            verbose,
        });
    }
    return {
        esbuildContextWeb,
        esbuildContextNode,
        runManagerContext,
    };
}

export interface RunNodeManagerOptions {
    featureName?: string;
    configName?: string;
    serveStatic: Required<EngineConfig>['serveStatic'];
    httpServerPort: number;
    outputPath: string;
    verbose: boolean;
    socketServerOptions: EngineConfig['socketServerOptions'];
}

export async function runNodeManager({
    serveStatic,
    httpServerPort,
    outputPath,
    featureName,
    configName,
    socketServerOptions,
    verbose,
}: RunNodeManagerOptions) {
    // start dev server
    const staticMiddlewares = serveStatic.map(({ route, directoryPath }) => ({
        path: route,
        handlers: express.static(directoryPath),
    }));

    const devMiddlewares: RouteMiddleware[] = [
        {
            path: '/dashboard',
            handlers: (req, res) => {
                res.sendFile(fs.join(__dirname, '../dashboard/index.html'));
            },
        },
    ];

    const server = await launchServer({
        httpServerPort,
        socketServerOptions,
        middlewares: [...devMiddlewares, ...staticMiddlewares],
    });

    if (verbose) {
        console.log(`Dev server is running. listening on http://localhost:${server.port}`);
    }

    const managerPath = ['.js', '.mjs']
        .map((ext) => fs.join(outputPath, 'node', `engine-environment-manager${ext}`))
        .find(fs.existsSync);

    if (!managerPath) {
        throw new Error(`Could not find "engine-environment-manager" entrypoint in ${fs.join(outputPath, 'node')}`);
    }

    if (verbose) {
        console.log(`Starting node environment manager at ${managerPath}`);
    }

    const managerProcess = fork(
        managerPath,
        [
            `--applicationPath=${fs.join(outputPath, 'web')}`,
            `--feature=${featureName}`,
            `--config=${configName}`,
            verbose ? '--verbose=true' : '',
        ],
        {
            execArgv: process.execArgv.concat(['--watch']),
            stdio: 'inherit',
        },
    );

    return { server, managerProcess };
}
