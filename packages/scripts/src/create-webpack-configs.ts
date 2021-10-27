import fs from '@file-services/node';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import semverLessThan from 'semver/functions/lt';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    webpackImportStatement,
    createExternalFeatureMapping,
} from './create-entrypoint';

import { WebpackScriptAttributesPlugin } from './webpack-html-attributes-plugins';
import { createVirtualEntries } from './virtual-modules-loader';
import type { IConfigDefinition, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import type { getResolvedEnvironments } from './utils/environments';
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
                enviroments: webEnvs,
                target: 'web',
            })
        );
    }
    if (workerEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: workerEnvs,
                target: 'webworker',
            })
        );
    }
    if (electronRendererEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: electronRendererEnvs,
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
    enviroments: Map<string, string[]>;
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
    enviroments,
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

    for (const [envName, childEnvs] of enviroments) {
        const config = typeof overrideConfig === 'function' ? overrideConfig(envName) : overrideConfig;
        const entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            envName,
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
    enviroments,
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

    const { module: baseModule = {} } = baseConfig;
    const { rules: baseRules = [] } = baseModule;

    const entryModules: Record<string, string> = {};

    for (const [envName, childEnvs] of enviroments) {
        entryModules[envName] = createExternalBrowserEntrypoint({
            ...feature,
            childEnvs,
            envName,
            loadStatement: webpackImportStatement,
            target: target === 'webworker' ? 'webworker' : 'web',
            eagerEntrypoint: true,
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
    const extractExternalsMethod = extractExternals(filePath, Object.keys(entries));

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
    (featurePath: string, ignoredRequests: string[]) =>
    ({ context, request }: { context?: string; request?: string }, cb: (e?: Error, target?: string) => void) => {
        try {
            if (!request || !context || ignoredRequests.includes(request) || request.includes('!=!')) {
                return cb();
            }
            const resolvedRequest = require.resolve(request, { paths: [context] });
            if (resolvedRequest !== featurePath && fs.basename(resolvedRequest).includes('.feature.')) {
                const packageJson = fs.findClosestFileSync(fs.dirname(resolvedRequest), 'package.json');
                if (!packageJson) {
                    throw new Error(`could not find package.json for ${resolvedRequest}`);
                }
                const { name } = fs.readJsonFileSync(packageJson) as { name: string };
                return cb(undefined, createExternalFeatureMapping(name, resolvedRequest));
            }
            cb();
        } catch (err) {
            cb(err as Error | undefined);
        }
    };
