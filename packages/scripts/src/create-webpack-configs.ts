import fs from '@file-services/node';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import semverLessThan from 'semver/functions/lt';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { createRequestResolver } from '@file-services/resolve';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    createExternalFeatureMapping,
    webpackImportStatement,
    LOADED_FEATURE_MODULES_NAMESPACE,
} from './create-entrypoint';

import { WebpackScriptAttributesPlugin } from './webpack-html-attributes-plugins';
import { createVirtualEntries } from './virtual-modules-loader';
import type { IConfigDefinition, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import type { getResolvedEnvironments, IResolvedEnvironment } from './utils/environments';
import type { IFeatureDefinition } from './types';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: webpack.Configuration;
    featureName?: string;
    configName?: string;
    singleFeature?: boolean;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    environments: Pick<ReturnType<typeof getResolvedEnvironments>, 'webEnvs' | 'workerEnvs' | 'electronRendererEnvs'>;
    publicPath?: string;
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: (options: ICreateWebpackConfigOptions) => webpack.Configuration;
    externalFeaturesRoute: string;
    eagerEntrypoint?: boolean;
    webpackHot?: boolean;
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const {
        baseConfig = {},
        publicPath = '',
        createWebpackConfig,
        environments: { electronRendererEnvs, webEnvs, workerEnvs },
        featureName,
    } = options;

    if (!baseConfig.output) {
        baseConfig.output = {};
    }
    baseConfig.output.publicPath = publicPath;

    const configurations: webpack.Configuration[] = [];

    if (webEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                environments: webEnvs,
                target: 'web',
            })
        );
    }
    if (workerEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                environments: workerEnvs,
                target: 'webworker',
            })
        );
    }
    if (featureName && electronRendererEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                environments: electronRendererEnvs,
                target: 'electron-renderer',
            })
        );
    }

    return configurations;
}

interface ICreateWebpackConfigOptions {
    baseConfig: webpack.Configuration;
    featureName?: string;
    configName?: string;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    environments: Map<string, IResolvedEnvironment>;
    publicPath?: string;
    target: 'web' | 'webworker' | 'electron-renderer';
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    externalFeaturesRoute: string;
    eagerEntrypoint?: boolean;
    webpackHot?: boolean;
    plugins?: webpack.WebpackPluginInstance[];
}

export function createWebpackConfig({
    baseConfig,
    target,
    environments,
    featureName,
    configName,
    features,
    context,
    mode = 'development',
    outputPath,
    publicPath,
    title,
    configurations,
    staticBuild,
    publicConfigsRoute,
    overrideConfig,
    externalFeaturesRoute,
    eagerEntrypoint,
    favicon,
    webpackHot = false,
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const { module: baseModule = {}, plugins: basePlugins = [] } = baseConfig;
    const { rules: baseRules = [] } = baseModule;
    const entryModules: Record<string, string> = {};
    const plugins: webpack.WebpackPluginInstance[] = [];

    for (const [envName, { childEnvs, env }] of environments) {
        const config = typeof overrideConfig === 'function' ? overrideConfig(envName) : overrideConfig;
        const entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            publicPath,
            configurations,
            mode,
            staticBuild,
            publicConfigsRoute,
            config,
            target,
            externalFeaturesRoute,
            eagerEntrypoint,
        });

        entryModules[envName] = entrypointContent;
        if (target === 'web' || target === 'electron-renderer') {
            plugins.push(
                ...[
                    new HtmlWebpackPlugin({
                        filename: `${envName}.html`,
                        chunks: [envName],
                        title,
                        favicon,
                    }),
                    new WebpackScriptAttributesPlugin({
                        scriptAttributes: {
                            crossorigin: 'anonymous',
                        },
                    }),
                ]
            );
        }
    }
    const { loaderRule, entries } = createVirtualEntries(entryModules);
    if (webpackHot) {
        for (const [entryName, entryValue] of Object.entries(entries)) {
            entries[entryName] = ['webpack-hot-middleware/client', entryValue as string];
        }
        // we need the hot middleware client into the env entry
        plugins.push(new webpack.HotModuleReplacementPlugin());
    }
    return {
        ...baseConfig,
        target,
        entry: entries,
        name: target,
        mode,
        module: { ...baseModule, rules: [...baseRules, loaderRule] },
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            ...baseConfig.output,
            path: outputPath,
            filename: `[name].${target}.js`,
            chunkFilename: `[name].${target}.js`,
        },
        plugins: [...basePlugins, ...plugins],
        stats: 'errors-warnings',
    };
}

export function createWebpackConfigForExternalFeature({
    baseConfig,
    target,
    environments,
    features,
    context,
    mode = 'development',
    outputPath,
    featureName,
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const feature = features.get(featureName!);
    if (!feature) {
        throw new Error(`${featureName!} was not found after analyzing features`);
    }
    const resolver = createRequestResolver({ fs });

    const { module: baseModule = {} } = baseConfig;
    const { rules: baseRules = [] } = baseModule;

    const entryModules: Record<string, string> = {};

    for (const [envName, { childEnvs, env }] of environments) {
        entryModules[envName] = createExternalBrowserEntrypoint({
            ...feature,
            childEnvs,
            env,
            target: target === 'webworker' ? 'webworker' : 'web',
            eagerEntrypoint: true,
            loadStatement: webpackImportStatement,
        });
    }
    const externalFeatures: Record<string, string> = {
        '@wixc3/engine-core': 'EngineCore',
    };
    const externals: webpack.Configuration['externals'] = [externalFeatures];
    const { packageName, scopedName, filePath } = feature;

    const userExternals = baseConfig.externals;
    if (userExternals) {
        if (Array.isArray(userExternals)) {
            externals.push(...userExternals);
        } else {
            externals.push(userExternals);
        }
    }
    const { loaderRule, entries } = createVirtualEntries(entryModules);

    const extractExternalsMethod = extractExternals(filePath, Object.keys(entries), resolver);

    const webpackConfig: webpack.Configuration = {
        ...baseConfig,
        target,
        entry: entries,
        mode,
        module: { ...baseModule, rules: [...baseRules, loaderRule] },
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            ...baseConfig.output,
            path: outputPath,
            filename: `[name].${target}.js`,
            chunkFilename: `[name].${target}.js`,
        },
        externals,
        optimization: {
            ...baseConfig.optimization,
            moduleIds: 'named',
        },
        stats: 'errors-warnings',
    };
    if (semverLessThan(webpack.version, '5.0.0')) {
        webpackConfig.output!.libraryTarget = 'var';
        (webpackConfig.output as { jsonpFunction: string }).jsonpFunction = packageName + scopedName;
        const webpack4ExtractExternalsAdaptation: any = (
            context: string,
            request: string,
            cb: (e?: Error, target?: string) => void
        ) => extractExternalsMethod({ context, request }, cb);
        externals.push(webpack4ExtractExternalsAdaptation);
    } else {
        externals.push(extractExternalsMethod);
    }
    return webpackConfig;
}

const extractExternals =
    (featurePath: string, ignoredRequests: string[], resolver: ReturnType<typeof createRequestResolver>) =>
    ({ context, request }: { context?: string; request?: string }, cb: (e?: Error, target?: string) => void) => {
        try {
            if (
                !request ||
                !context ||
                ignoredRequests.includes(request) ||
                request.includes('!=!') ||
                request.startsWith('!')
            ) {
                return cb();
            }

            const { resolvedFile: resolvedRequest } = resolver(context, request);
            if (
                resolvedRequest &&
                resolvedRequest !== featurePath &&
                fs.basename(resolvedRequest).includes('.feature.')
            ) {
                const packageJson = fs.findClosestFileSync(fs.dirname(resolvedRequest), 'package.json');
                if (!packageJson) {
                    throw new Error(`could not find package.json for ${resolvedRequest}`);
                }
                const { name } = fs.readJsonFileSync(packageJson) as { name: string };
                return cb(
                    undefined,
                    `self.${LOADED_FEATURE_MODULES_NAMESPACE}[${JSON.stringify(
                        createExternalFeatureMapping(name, resolvedRequest)
                    )}]`
                );
            }
            cb();
        } catch (err) {
            cb(err as Error | undefined);
        }
    };
