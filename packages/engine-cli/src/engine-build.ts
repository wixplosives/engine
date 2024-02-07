import fs from '@file-services/node';
import { ConfigurationEnvironmentMapping, FeatureEnvironmentMapping, importModules } from '@wixc3/engine-runtime-node';
import { ENGINE_CONFIG_FILE_NAME, EngineConfig, analyzeFeatures } from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';
import { loadConfigFile } from './load-config-file';
import { parseArgs } from 'node:util';
import { TopLevelConfig } from '@wixc3/engine-core';
import { writeWatchSignal } from './watch-signal';
import { resolveBuildEntryPoints } from './resolve-build-configurations';
import { launchDevServer } from './launch-dashboard-server';
import { createBuildConfiguration } from './create-environments-build-configuration';
import { readEntryPoints, readMetadataFiles, writeEntryPoints, writeMetaFiles } from './metadata-files';
import { EntryPoints } from './create-entrypoints';

export type RunEngineOptions = Parameters<typeof runEngine>[0];

export async function runEngine({
    verbose = false,
    clean = true,
    watch = false,
    dev = false,
    run = false,
    build = true,
    forceAnalyze = false,
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
    let featureEnvironmentsMapping: FeatureEnvironmentMapping;
    let configMapping: ConfigurationEnvironmentMapping;
    let entryPoints: EntryPoints;
    let _waitForBuildReady: ((cb: () => void) => boolean) | undefined;
    rootDir = fs.resolve(rootDir);
    outputPath = fs.resolve(rootDir, outputPath);

    const jsOutExtension = '.js' as '.js' | '.mjs';
    const nodeFormat = jsOutExtension === '.mjs' ? 'esm' : 'cjs';

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

    const cachedMetadata = forceAnalyze ? undefined : readMetadataFiles(outputPath);
    const cachedEntryPoints = forceAnalyze ? undefined : readEntryPoints(outputPath);

    if (clean) {
        if (verbose) {
            console.log(`Cleaning ${outputPath}`);
        }
        await fs.promises.rm(outputPath, { recursive: true, force: true });
    }

    const _analyzeForBuild = () =>
        analyzeForBuild({
            rootDir,
            featureDiscoveryRoot,
            featureName,
            extensions,
            buildConditions,
            mode,
            configName,
            dev,
            publicPath,
            publicConfigsRoute,
            jsOutExtension,
            nodeFormat,
            writeMetadataFiles,
            outputPath,
        });

    if (!cachedMetadata || !cachedEntryPoints) {
        const result = await _analyzeForBuild();
        featureEnvironmentsMapping = result.featureEnvironmentsMapping;
        configMapping = result.configMapping;
        entryPoints = result.entryPoints;
    } else {
        console.log('Skip analyze. Using cached metadata and entrypoints');
        featureEnvironmentsMapping = cachedMetadata.featureEnvironmentsMapping;
        configMapping = cachedMetadata.configMapping;
        entryPoints = cachedEntryPoints;
        if (clean) {
            writeMetaFiles(outputPath, featureEnvironmentsMapping, configMapping);
            writeEntryPoints(outputPath, entryPoints);
        }
    }

    const buildConfigurations = createBuildConfiguration(
        {
            buildPlugins,
            dev,
            outputPath,
            publicPath,
            buildConditions,
            extensions,
        },
        entryPoints,
        jsOutExtension,
        nodeFormat,
    );

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
            _analyzeForBuild,
            _waitForBuildReady,
        );
        if (watch) {
            writeWatchSignal(outputPath, { isAliveUrl: `http://localhost:${devServer.port}/is_alive` });
        }
        console.log(`Engine dev server is running at http://localhost:${devServer.port}/dashboard`);
    }
    return {
        featureEnvironmentsMapping,
        configMapping,
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

async function analyzeForBuild({
    rootDir,
    featureDiscoveryRoot,
    featureName,
    extensions,
    buildConditions,
    mode,
    configName,
    dev,
    publicPath,
    publicConfigsRoute,
    jsOutExtension,
    nodeFormat,
    writeMetadataFiles,
    outputPath,
}: {
    rootDir: string;
    featureDiscoveryRoot: string;
    featureName: string | undefined;
    extensions: string[] | undefined;
    buildConditions: string[] | undefined;
    mode: 'development' | 'production';
    configName: string | undefined;
    dev: boolean;
    publicPath: string;
    publicConfigsRoute: string;
    jsOutExtension: '.js' | '.mjs';
    nodeFormat: 'esm' | 'cjs';
    writeMetadataFiles: boolean;
    outputPath: string;
}) {
    const { features, configurations } = await analyzeFeatures(
        fs,
        rootDir,
        featureDiscoveryRoot,
        featureName,
        extensions,
        buildConditions,
    );

    const resolved = resolveBuildEntryPoints({
        features,
        configurations,
        mode,
        configName,
        featureName,
        dev,
        publicPath,
        publicConfigsRoute,
        jsOutExtension,
        nodeFormat,
    });

    if (writeMetadataFiles) {
        writeBuildCache(outputPath, resolved);
    }
    return resolved;
}

function writeBuildCache(outputPath: string, resolved: ReturnType<typeof resolveBuildEntryPoints>) {
    writeMetaFiles(outputPath, resolved.featureEnvironmentsMapping, resolved.configMapping);
    writeEntryPoints(outputPath, resolved.entryPoints);
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
