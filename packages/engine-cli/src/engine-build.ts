import { nodeFs as fs } from '@file-services/node';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    importModules,
    readMetadataFiles,
    writeMetaFiles,
} from '@wixc3/engine-runtime-node';
import esbuild from 'esbuild';
import { createBuildEndPluginHook } from './esbuild-build-end-plugin';
import { loadConfigFile } from './load-config-file';
import { parseArgs } from 'node:util';
import { writeWatchSignal } from './watch-signal';
import { resolveBuildEntryPoints } from './resolve-build-configurations';
import { ConfigLoadingMode, launchDashboardServer } from './launch-dashboard-server';
import { createBuildConfiguration } from './create-environments-build-configuration';
import { readEntryPoints, writeEntryPoints } from './entrypoint-files';
import { EntryPoints, EntryPointsPaths } from './create-entrypoints';
import { resolveRuntimeOptions } from './resolve-runtime-options';
import type { EngineConfig } from './types';
import { analyzeFeatures } from './find-features/analyze-features';
import { ENGINE_CONFIG_FILE_NAME } from './find-features/build-constants';

export interface RunEngineOptions {
    verbose?: boolean;
    clean?: boolean;
    watch?: boolean;
    dev?: boolean;
    run?: boolean;
    build?: boolean;
    forceAnalyze?: boolean;
    rootDir?: string;
    outputPath?: string;
    feature?: string;
    config?: string;
    httpServerPort?: number;
    buildTargets?: 'node' | 'web' | 'both' | 'electron';
    engineConfig?: EngineConfig;
    runtimeArgs?: Record<string, string | boolean>;
    writeMetadataFiles?: boolean;
    publicPath?: string;
    publicConfigsRoute?: string;
    configLoadingMode?: ConfigLoadingMode;
    staticBuild?: boolean;
    title?: string;
}

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
    feature: featureName,
    config: configName,
    httpServerPort = 5555,
    buildTargets = 'both',
    engineConfig = {},
    runtimeArgs = {},
    writeMetadataFiles = !watch,
    publicConfigsRoute = 'configs',
    configLoadingMode = 'require',
    staticBuild = false,
    title,
}: RunEngineOptions = {}): Promise<{
    featureEnvironmentsMapping: FeatureEnvironmentMapping;
    configMapping: ConfigurationEnvironmentMapping;
    devServer?: Awaited<ReturnType<typeof launchDashboardServer>>;
    esbuildContextWeb?: esbuild.BuildContext;
    esbuildContextNode?: esbuild.BuildContext;
}> {
    const mode: '' | 'development' | 'production' = dev ? 'development' : 'production';
    let esbuildContextWeb: esbuild.BuildContext | undefined;
    let esbuildContextNode: esbuild.BuildContext | undefined;
    let devServer: Awaited<ReturnType<typeof launchDashboardServer>> | undefined;
    let featureEnvironmentsMapping: FeatureEnvironmentMapping;
    let configMapping: ConfigurationEnvironmentMapping;
    let entryPoints: EntryPoints;
    let entryPointsPaths: EntryPointsPaths | undefined;
    let waitForWebRebuild: ((cb: () => void) => boolean) | undefined;
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
        favicon,
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

    const analyze = async () => {
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
            staticBuild,
            buildElectron: buildTargets === 'electron',
        });

        if (writeMetadataFiles) {
            writeMetaFiles(outputPath, resolved.featureEnvironmentsMapping, resolved.configMapping);
            const entryPointsPaths = writeEntryPoints(outputPath, resolved.entryPoints);
            return {
                ...resolved,
                entryPointsPaths,
            };
        }
        return resolved;
    };

    if (!cachedMetadata || !cachedEntryPoints) {
        const result = await analyze();
        featureEnvironmentsMapping = result.featureEnvironmentsMapping;
        configMapping = result.configMapping;
        entryPoints = result.entryPoints;
        entryPointsPaths = 'entryPointsPaths' in result ? result.entryPointsPaths : undefined;
    } else {
        console.log('Skip analyze. Using cached metadata and entrypoints');
        featureEnvironmentsMapping = cachedMetadata.featureEnvironmentsMapping;
        configMapping = cachedMetadata.configMapping;
        entryPoints = cachedEntryPoints;
        entryPointsPaths = cachedEntryPoints;
        if (clean) {
            writeMetaFiles(outputPath, featureEnvironmentsMapping, configMapping);
            writeEntryPoints(outputPath, entryPoints);
        }
    }

    const buildConfigurations = createBuildConfiguration({
        buildPlugins,
        dev,
        outputPath,
        publicPath,
        buildConditions,
        extensions,
        entryPoints,
        jsOutExtension,
        nodeFormat,
        entryPointsPaths,
        staticBuild,
        title,
        favicon,
    });

    if (watch) {
        if (shouldBuildWeb(buildTargets)) {
            if (verbose) {
                console.log('Starting web compilation in watch mode');
            }
            const { buildEndPlugin, waitForBuildEnd, waitForRebuild } = createBuildEndPluginHook();
            waitForWebRebuild = waitForRebuild;
            buildConfigurations.webConfig.plugins.push(buildEndPlugin);
            esbuildContextWeb = await esbuild.context(buildConfigurations.webConfig);
            // TODO: use our own watch system to avoid duplicate watchers
            await esbuildContextWeb.watch();
            if (verbose) {
                console.log('Waiting for web build end.');
            }
            await Promise.allSettled([waitForBuildEnd()]);
        }

        if (shouldBuildNode(buildTargets)) {
            if (verbose) {
                console.log('Starting node compilation in watch mode');
            }
            const { buildEndPlugin, waitForBuildEnd } = createBuildEndPluginHook();
            buildConfigurations.nodeConfig.plugins.push(buildEndPlugin);
            esbuildContextNode = await esbuild.context(buildConfigurations.nodeConfig);
            // TODO: use our own watch system to avoid duplicate watchers
            await esbuildContextNode.watch();
            if (verbose) {
                console.log('Waiting for node build end.');
            }
            await Promise.allSettled([waitForBuildEnd()]);
        }
    } else if (build) {
        const start = performance.now();
        await Promise.all([
            shouldBuildNode(buildTargets) ? esbuild.build(buildConfigurations.nodeConfig) : Promise.resolve(),
            shouldBuildWeb(buildTargets) ? esbuild.build(buildConfigurations.webConfig) : Promise.resolve(),
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

        devServer = await launchDashboardServer(
            rootDir,
            serveStatic,
            httpServerPort,
            socketServerOptions,
            featureEnvironmentsMapping,
            configMapping,
            runtimeOptions,
            outputPath,
            configLoadingMode,
            analyze,
            waitForWebRebuild,
            buildConditions,
            extensions,
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

function shouldBuildWeb(buildTargets: 'node' | 'web' | 'both' | 'electron') {
    return buildTargets === 'web' || buildTargets === 'both' || buildTargets === 'electron';
}

function shouldBuildNode(buildTargets: 'node' | 'web' | 'both' | 'electron') {
    return buildTargets === 'node' || buildTargets === 'both' || buildTargets === 'electron';
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
