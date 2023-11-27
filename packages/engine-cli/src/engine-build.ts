import fs from '@file-services/node';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    IConfigDefinition,
    NodeEnvManager,
    createFeatureEnvironmentsMapping,
    importModules,
} from '@wixc3/engine-runtime-node';
import {
    ENGINE_CONFIG_FILE_NAME,
    EngineConfig,
    IFeatureDefinition,
    OverrideConfigHook,
    StaticConfig,
    analyzeFeatures,
    createAllValidConfigurationsEnvironmentMapping,
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
import { join, resolve } from 'node:path';
import { TopLevelConfig } from '@wixc3/engine-core';
import { SetMultiMap } from '@wixc3/patterns';
import { pathToFileURL } from 'node:url';

export type RunEngineOptions = Parameters<typeof runEngine>[0];

export async function runEngine({
    verbose = false,
    clean = true,
    watch = false,
    dev = false,
    run = false,
    build = true,
    rootDir = process.cwd(),
    outputPath = 'dist-engine',
    publicPath = '',
    feature: featureName = undefined as string | undefined,
    config: configName = undefined as string | undefined,
    httpServerPort = 5555,
    buildTargets = 'both' as 'node' | 'web' | 'both',
    engineConfig = {} as EngineConfig,
    runtimeArgs = {} as Record<string, string | boolean>,
    writeMetadataFiles = !watch as boolean,
} = {}) {
    const mode: '' | 'development' | 'production' = dev ? 'development' : 'production';
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

    if (clean) {
        if (verbose) {
            console.log(`Cleaning ${outputPath}`);
        }
        await fs.promises.rm(outputPath, { recursive: true, force: true });
    }

    const buildConfigurationsOptions = {
        features,
        configurations,
        mode,
        configName,
        featureName,
        dev,
        buildPlugins,
        publicPath,
        outputPath,
        extensions,
        buildConditions,
    };

    if (watch) {
        const { buildConfigurations } = resolveBuildConfigurations(buildConfigurationsOptions);

        if (buildTargets === 'web' || buildTargets === 'both') {
            if (verbose) {
                console.log('Starting web compilation in watch mode');
            }
            const { buildEndPlugin, waitForBuildEnd } = createBuildEndPluginHook();
            buildConfigurations.webConfig.plugins.push(buildEndPlugin);
            esbuildContextWeb = await esbuild.context(buildConfigurations.webConfig);
            await esbuildContextWeb.watch();
            if (verbose) {
                console.log('Waiting for web build end.');
            }
            await waitForBuildEnd();
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
    } else if (build) {
        const { buildConfigurations, featureEnvironmentsMapping, configMapping } =
            resolveBuildConfigurations(buildConfigurationsOptions);

        const start = performance.now();
        await Promise.all([
            buildTargets === 'node' || buildTargets === 'both'
                ? esbuild.build(buildConfigurations.nodeConfig)
                : Promise.resolve(),
            buildTargets === 'web' || buildTargets === 'both'
                ? esbuild.build(buildConfigurations.webConfig)
                : Promise.resolve(),
        ]);
        if (writeMetadataFiles) {
            fs.writeFileSync(
                join(buildConfigurations.nodeConfig.outdir, 'engine-feature-environments-mapping.json'),
                JSON.stringify(featureEnvironmentsMapping, null, 2),
            );
            fs.writeFileSync(
                join(buildConfigurations.nodeConfig.outdir, 'engine-config-mapping.json'),
                JSON.stringify(configMapping, null, 2),
            );
        }
        const end = performance.now();
        console.log(`Build time ${Math.round(end - start)}ms`);
    }
    if (run) {
        if (verbose) {
            console.log('Running engine node environment manager');
        }

        const runtimeOptions = resolveRuntimeOptions({
            featureName,
            configName,
            outputPath,
            verbose,
            runtimeArgs,
        });

        if (verbose) {
            console.log(`Runtime options: ${JSON.stringify(Object.fromEntries(runtimeOptions.entries()), null, 2)}`);
        }

        runManagerContext = runNodeManager({
            cwd: rootDir,
            watch,
            outputPath,
            runtimeOptions,
        });

        devServer = await launchDevServer(serveStatic, httpServerPort, socketServerOptions);
        if (verbose) {
            console.log(`Dev server is running. listening on http://localhost:${devServer.port}`);
        }
    }
    return {
        features,
        configurations,
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
    runtimeArgs?: Record<string, string | boolean>;
    topLevelConfig?: TopLevelConfig;
}

function resolveBuildConfigurations({
    features,
    configurations,
    mode,
    configName,
    featureName,
    dev,
    buildPlugins,
    publicPath,
    outputPath,
    extensions,
    buildConditions,
}: {
    features: Map<string, IFeatureDefinition>;
    configurations: SetMultiMap<string, IConfigDefinition>;
    mode: 'development' | 'production';
    configName: string | undefined;
    featureName: string | undefined;
    dev: boolean;
    buildPlugins: esbuild.Plugin[] | OverrideConfigHook;
    publicPath: string;
    outputPath: string;
    extensions: string[] | undefined;
    buildConditions: string[] | undefined;
}) {
    const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(features);
    const configMapping = createAllValidConfigurationsEnvironmentMapping(configurations, mode, configName);

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
        featureEnvironmentsMapping,
        configMapping,
        features,
        environments,
        publicPath,
        outputPath,
        featureName,
        configName,
        extensions,
        buildConditions,
    });
    return { buildConfigurations, featureEnvironmentsMapping, configMapping, environments };
}

function findNodeEnvManagerEntrypoint(outputPath: any) {
    const managerPath = ['.js', '.mjs']
        .map((ext) => fs.join(outputPath, 'node', `engine-environment-manager${ext}`))
        .find(fs.existsSync);

    if (!managerPath) {
        throw new Error(`Could not find "engine-environment-manager" entrypoint in ${fs.join(outputPath, 'node')}`);
    }
    return managerPath;
}

export function resolveRuntimeOptions({
    outputPath,
    featureName,
    configName,
    verbose,
    runtimeArgs,
    topLevelConfig,
}: RunNodeManagerOptions) {
    const runtimeOptions = new Map<string, string | boolean | undefined>();
    runtimeOptions.set('applicationPath', fs.join(outputPath, 'web'));
    runtimeOptions.set('feature', featureName);
    if (verbose) {
        runtimeOptions.set('verbose', 'true');
    }
    if (configName) {
        runtimeOptions.set('config', configName);
    }
    if (runtimeArgs) {
        for (const [key, value] of Object.entries(runtimeArgs)) {
            runtimeOptions.set(key, value);
        }
    }
    if (topLevelConfig) {
        runtimeOptions.set('topLevelConfig', JSON.stringify(topLevelConfig));
    }
    return runtimeOptions;
}

export function runNodeManager({
    outputPath,
    runtimeOptions,
    cwd,
    watch,
}: {
    outputPath: string;
    runtimeOptions: Map<string, string | boolean | undefined>;
    cwd?: string;
    watch?: boolean;
}) {
    const managerProcess = fork(
        findNodeEnvManagerEntrypoint(outputPath),
        Array.from(runtimeOptions.entries()).map(([key, value]) => `--${key}=${value}`),
        {
            cwd: cwd ? resolve(cwd) : process.cwd(),
            execArgv: watch ? process.execArgv.concat(['--watch']) : process.execArgv,
            // execArgv: process.execArgv,
        },
    );
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

export async function runLocalNodeManager(
    featureEnvironmentsMapping: FeatureEnvironmentMapping,
    configMapping: ConfigurationEnvironmentMapping,
    configName: string,
    execRuntimeOptions: Map<string, string | boolean | undefined>,
    outputPath: string = 'dist-engine',
) {
    const meta = { url: pathToFileURL(join(outputPath, 'node/')).href };
    const manager = new NodeEnvManager(meta, featureEnvironmentsMapping, configMapping);
    const { port } = await manager.autoLaunch(execRuntimeOptions);
    return { port, manager };
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

export function readMetadataFiles(dir: string) {
    const featureEnvironmentsMapping = fs.readJsonFileSync(
        join(dir, 'node', 'engine-feature-environments-mapping.json'),
    ) as ReturnType<typeof createFeatureEnvironmentsMapping>;
    const configMapping = fs.readJsonFileSync(join(dir, 'node', 'engine-config-mapping.json')) as ReturnType<
        typeof createAllValidConfigurationsEnvironmentMapping
    >;
    return { featureEnvironmentsMapping, configMapping };
}
