import fs from '@file-services/node';
import { importModules } from '@wixc3/engine-runtime-node';
import { ENGINE_CONFIG_FILE_NAME, EngineConfig, analyzeFeatures } from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';
import { loadConfigFile } from './load-config-file';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { TopLevelConfig } from '@wixc3/engine-core';
import { writeWatchSignal } from './watch-signal';
import { resolveBuildConfigurations } from './resolve-build-configurations';
import { launchDevServer } from './launch-dashboard-server';

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
    publicConfigsRoute = 'configs',
} = {}) {
    const mode: '' | 'development' | 'production' = dev ? 'development' : 'production';
    let esbuildContextWeb: esbuild.BuildContext | undefined;
    let esbuildContextNode: esbuild.BuildContext | undefined;
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

    if (clean) {
        if (verbose) {
            console.log(`Cleaning ${outputPath}`);
        }
        await fs.promises.rm(outputPath, { recursive: true, force: true });
    }

    const { features, configurations } = await analyzeFeatures(
        fs,
        rootDir,
        featureDiscoveryRoot,
        featureName,
        extensions,
        buildConditions,
    );

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
        publicConfigsRoute,
    };

    const { buildConfigurations, featureEnvironmentsMapping, configMapping } =
        resolveBuildConfigurations(buildConfigurationsOptions);
    if (writeMetadataFiles) {
        fs.mkdirSync(join(buildConfigurations.nodeConfig.outdir), { recursive: true });
        fs.writeFileSync(
            join(buildConfigurations.nodeConfig.outdir, 'engine-feature-environments-mapping.json'),
            JSON.stringify(featureEnvironmentsMapping, null, 2),
        );
        fs.writeFileSync(
            join(buildConfigurations.nodeConfig.outdir, 'engine-config-mapping.json'),
            JSON.stringify(configMapping, null, 2),
        );
    }
    let _waitForBuildReady: ((cb: () => void) => boolean) | undefined;
    if (watch) {
        if (buildTargets === 'web' || buildTargets === 'both') {
            if (verbose) {
                console.log('Starting web compilation in watch mode');
            }
            const { buildEndPlugin, waitForBuildEnd, waitForBuildReady } = createBuildEndPluginHook();
            _waitForBuildReady = waitForBuildReady;
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

        devServer = await launchDevServer(
            serveStatic,
            httpServerPort,
            socketServerOptions,
            featureEnvironmentsMapping,
            configMapping,
            runtimeOptions,
            outputPath,
            _waitForBuildReady,
        );
        if (watch) {
            writeWatchSignal(outputPath, { isAliveUrl: `http://localhost:${devServer.port}/is_alive` });
        }
        console.log(`Engine dev server is running at http://localhost:${devServer.port}/dashboard`);
    }
    return {
        features,
        configurations,
        devServer,
        esbuildContextWeb,
        esbuildContextNode,
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
