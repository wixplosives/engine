import fs from '@file-services/node';
import { importModules } from '@wixc3/engine-runtime-node';
import {
    ENGINE_CONFIG_FILE_NAME,
    EngineConfig,
    StaticConfig,
    analyzeFeatures,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import express from 'express';
import { fork } from 'node:child_process';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';
import { loadConfigFile } from './load-config-file';
import { LaunchOptions, RouteMiddleware, launchServer } from './start-dev-server';
import { parseArgs } from 'node:util';

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
    engineConfig?: EngineConfig;
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
    engineConfig = {},
}: RunEngineOptions = {}) {
    let esbuildContextWeb: esbuild.BuildContext | undefined;
    let esbuildContextNode: esbuild.BuildContext | undefined;
    let runManagerContext: Awaited<ReturnType<typeof runNodeManager>> | undefined;
    let devServer: Awaited<ReturnType<typeof launchDevServer>> | undefined;

    rootDir = fs.resolve(rootDir);
    outputPath = fs.resolve(rootDir, outputPath);

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
            console.log('Running engine node environment manager');
        }

        runManagerContext = runNodeManager({
            featureName,
            configName,
            outputPath,
            verbose,
            watch,
        });

        devServer = await launchDevServer(serveStatic, httpServerPort, socketServerOptions);
        if (verbose) {
            console.log(`Dev server is running. listening on http://localhost:${devServer.port}`);
        }
    }
    return {
        devServer,
        esbuildContextWeb,
        esbuildContextNode,
        runManagerContext,
    };
}

export interface RunNodeManagerOptions {
    outputPath: string;
    featureName?: string;
    configName?: string;
    verbose?: boolean;
    watch?: boolean;
}

export function runNodeManager({ outputPath, featureName, configName, watch, verbose }: RunNodeManagerOptions) {
    const managerPath = ['.js', '.mjs']
        .map((ext) => fs.join(outputPath, 'node', `engine-environment-manager${ext}`))
        .find(fs.existsSync);

    if (!managerPath) {
        throw new Error(`Could not find "engine-environment-manager" entrypoint in ${fs.join(outputPath, 'node')}`);
    }

    if (verbose) {
        console.log(`Starting node environment manager at ${managerPath}`);
    }
    const args = [`--applicationPath=${fs.join(outputPath, 'web')}`, `--feature=${featureName}`];
    if (configName) {
        args.push(`--config=${configName}`);
    }
    if (verbose) {
        args.push('--verbose=true');
    }
    const managerProcess = fork(managerPath, args, {
        execArgv: watch ? process.execArgv.concat(['--watch']) : process.execArgv,
    });

    return { managerProcess };
}

async function launchDevServer(
    serveStatic: StaticConfig[],
    httpServerPort: number,
    socketServerOptions: LaunchOptions['socketServerOptions'],
) {
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

    return await launchServer({
        httpServerPort,
        socketServerOptions,
        middlewares: [...devMiddlewares, ...staticMiddlewares],
    });
}

export async function loadEngineConfig(rootDir: string, engineConfigFilePath?: string) {
    const configFilePath =
        engineConfigFilePath || (await fs.promises.findClosestFile(rootDir, ENGINE_CONFIG_FILE_NAME));
    return (configFilePath ? await loadConfigFile(configFilePath) : {}) as EngineConfig;
}

export function parseCliArgs() {
    const { values: args } = parseArgs({
        strict: false,
        allowPositionals: false,
    });
    return new Map(Object.entries(args));
}
