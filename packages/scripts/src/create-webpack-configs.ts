import type webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type { TopLevelConfig } from '@wixc3/engine-core';
import { createMainEntrypoint } from './create-web-entrypoint';
import type { IConfigDefinition, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition } from './types';
import type { getResolvedEnvironments, IResolvedEnvironment } from './utils/environments';
import { createVirtualEntries } from './virtual-modules-loader';
import { WebpackScriptAttributesPlugin } from './webpack-html-attributes-plugins';
import type { SetMultiMap } from '@wixc3/patterns';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: webpack.Configuration;
    featureName?: string;
    configName?: string;
    singleFeature?: boolean;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    publicPath?: string;
    publicPathVariableName?: string;
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: (options: ICreateWebpackConfigOptions) => webpack.Configuration;
    eagerEntrypoint?: boolean;
    configLoaderModuleName?: string;
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const {
        baseConfig = {},
        publicPath = '',
        createWebpackConfig,
        environments: { electronRendererEnvs, webEnvs, workerEnvs },
        featureName,
        configLoaderModuleName,
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
                configLoaderModuleName,
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
                configLoaderModuleName,
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
                configLoaderModuleName,
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
    publicPathVariableName?: string;
    target: 'web' | 'webworker' | 'electron-renderer';
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    eagerEntrypoint?: boolean;
    plugins?: webpack.WebpackPluginInstance[];
    configLoaderModuleName?: string;
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
    publicPathVariableName,
    title,
    configurations,
    staticBuild,
    publicConfigsRoute,
    overrideConfig,
    eagerEntrypoint,
    favicon,
    configLoaderModuleName,
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
            publicPathVariableName,
            configurations,
            mode,
            staticBuild,
            publicConfigsRoute,
            config,
            eagerEntrypoint,
            configLoaderModuleName,
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
