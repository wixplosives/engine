import { TopLevelConfig } from '@wixc3/engine-core';
import { IConfigDefinition } from '@wixc3/engine-runtime-node';
import {
    IFeatureDefinition,
    createMainEntrypoint,
    createNodeEntrypoint,
    createNodeEnvironmentManagerEntrypoint,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/patterns';
import { BuildOptions, Plugin } from 'esbuild';
import { topLevelConfigPlugin } from './top-level-config-plugin-esbuild';
import { join } from 'node:path';
import { rawLoaderPlugin } from './esbuild-raw-loader-plugin';
import { htmlPlugin } from './esbuild-html-plugin';
import { dynamicEntryPlugin } from './esbuild-dynamic-entry-plugin';

export interface CreateEnvBuildConfigOptions {
    dev: boolean;
    buildPlugins: Plugin[];
    configurations: SetMultiMap<string, IConfigDefinition>;
    features: Map<string, IFeatureDefinition>;
    publicPath: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    config: TopLevelConfig;
    outputPath: string;
    featureName?: string;
    configName?: string;
    buildConditions?: string[];
    extensions?: string[];
}

export function createEnvironmentsBuildConfiguration(options: CreateEnvBuildConfigOptions) {
    const {
        dev,
        featureName,
        configName,
        outputPath,
        environments,
        publicPath,
        features,
        configurations,
        config,
        buildPlugins,
        buildConditions = [],
        extensions,
    } = options;

    const mode = dev ? 'development' : 'production';
    const jsOutExtension = '.mjs';
    const webEntryPoints = new Map<string, string>();
    const nodeEntryPoints = new Map<string, string>([
        [
            `engine-environment-manager${jsOutExtension}`,
            createNodeEnvironmentManagerEntrypoint({ features, configurations, mode, configName }),
        ],
    ]);
    const browserTargets = concatIterables(environments.webEnvs.values(), environments.workerEnvs.values());
    const nodeTargets = concatIterables(environments.nodeEnvs.values(), environments.workerThreadEnvs.values());

    for (const { env, childEnvs } of browserTargets) {
        const entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            publicPath,
            publicPathVariableName: 'PUBLIC_PATH',
            configurations,
            mode,
            staticBuild: false,
            publicConfigsRoute: '/configs',
            config,
        });

        webEntryPoints.set(
            `${env.name}.${env.type === 'webworker' ? 'webworker' : 'web'}${jsOutExtension}`,
            entrypointContent,
        );
    }

    for (const { env, childEnvs } of nodeTargets) {
        const entrypointContent = createNodeEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            configurations,
            mode,
            staticBuild: false,
            publicConfigsRoute: '/configs',
            config,
        });
        nodeEntryPoints.set(`${env.name}.${env.type}${jsOutExtension}`, entrypointContent);
    }

    const commonConfig = {
        target: 'es2020',
        bundle: true,
        format: 'esm',
        publicPath,
        metafile: true,
        sourcemap: true,
        keepNames: true,
        conditions: [...buildConditions, 'browser', 'import', 'require'],
        resolveExtensions: extensions,
        outExtension: { '.js': jsOutExtension },
        loader: {
            '.json': 'json',
            '.png': 'file',
            '.jpeg': 'file',
            '.jpg': 'file',
            '.svg': 'file',
            '.woff': 'file',
            '.woff2': 'file',
            '.ttf': 'file',
        },
        plugins: [...buildPlugins, rawLoaderPlugin(), topLevelConfigPlugin({ emit: !dev })],
    } satisfies BuildOptions;

    const webConfig = {
        ...commonConfig,
        platform: 'browser',
        outdir: join(outputPath, 'web'),
        banner: {
            js: `globalThis.__webpack_public_path__ = ${JSON.stringify(publicPath)};\n`,
        },
        plugins: [
            ...commonConfig.plugins,
            dynamicEntryPlugin({ entryPoints: webEntryPoints, loader: 'js' }),
            htmlPlugin({
                toHtmlPath(key) {
                    const entry = webEntryPoints.get(key);
                    if (!entry) {
                        throw new Error(`Could not find entrypoint for ${key} in ${[...webEntryPoints.keys()]}}`);
                    }
                    const [envName] = key.split('.');
                    return `${envName}.html`;
                },
            }),
        ],
    } satisfies BuildOptions;

    const nodeConfig = {
        ...commonConfig,
        platform: 'node',
        outdir: join(outputPath, 'node'),
        plugins: [...commonConfig.plugins, dynamicEntryPlugin({ entryPoints: nodeEntryPoints, loader: 'js' })],
    } satisfies BuildOptions;

    return {
        webConfig,
        nodeConfig,
    };
}

function* concatIterables<T>(...iterables: Iterable<T>[]) {
    for (const iterable of iterables) {
        yield* iterable;
    }
}
