import fs from '@file-services/node';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    remapFileRequest,
    webpackImportStatement,
    LOADED_FEATURE_MODULES_NAMESPACE,
} from './create-entrypoint';
import type {
    IEnvironment,
    IFeatureDefinition,
    IConfigDefinition,
    TopLevelConfigProvider,
    IExtenalFeatureDescriptor,
} from './types';
import { basename, join } from 'path';
import { getResolvedEnvironments } from './utils/environments';
import { EXTERNAL_FEATURES_BASE_URI } from './commons';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: webpack.Configuration;
    featureName?: string;
    configName?: string;
    singleFeature?: boolean;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    environments: IEnvironment[];
    publicPath?: string;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: (options: ICreateWebpackConfigOptions) => webpack.Configuration;
    externalFeatures: IExtenalFeatureDescriptor[];
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const { baseConfig = {}, publicPath = '', createWebpackConfig } = options;

    if (!baseConfig.output) {
        baseConfig.output = {};
    }
    baseConfig.output.publicPath = publicPath;
    const configurations: webpack.Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    const { electronRendererEnvs, webEnvs, workerEnvs } = getResolvedEnvironments(options);

    if (webEnvs.size) {
        const plugins: webpack.Plugin[] = [new VirtualModulesPlugin(virtualModules)];
        const entry: webpack.Entry = {};
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: webEnvs,
                target: 'web',
                virtualModules,
                plugins,
                entry,
                externalFeatures: filterExternalFeatures(webEnvs),
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
                virtualModules,
                plugins: [new VirtualModulesPlugin(virtualModules)],
                externalFeatures: filterExternalFeatures(workerEnvs),
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
                virtualModules,
                plugins: [new VirtualModulesPlugin(virtualModules)],
                externalFeatures: filterExternalFeatures(workerEnvs),
            })
        );
    }

    return configurations;

    function filterExternalFeatures(envs: Map<string, string[]>): IExtenalFeatureDescriptor[] {
        return options.externalFeatures.map<IExtenalFeatureDescriptor>(({ envEntries, name }) => ({
            name,
            envEntries: Object.entries(envEntries)
                .filter(([envName]) => envs.has(envName))
                .reduce((acc, [key, val]) => {
                    acc[key] = val;
                    return acc;
                }, {} as Record<string, string>),
        }));
    }
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
    target: 'web' | 'webworker' | 'electron-renderer' | 'node';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
    entry?: webpack.Entry;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    externalFeatures: IExtenalFeatureDescriptor[];
}

export function createWebpackConfig({
    baseConfig,
    target,
    enviroments,
    virtualModules,
    featureName,
    configName,
    features,
    context,
    mode = 'development',
    outputPath,
    plugins = [],
    entry = {},
    publicPath,
    title,
    configurations,
    staticBuild,
    publicConfigsRoute,
    overrideConfig,
    externalFeatures,
}: ICreateWebpackConfigOptions): webpack.Configuration {
    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(context, `${envName}-${target}-entry.js`);
        const config = typeof overrideConfig === 'function' ? overrideConfig(envName) : overrideConfig;
        entry[envName] = entryPath;
        virtualModules[entryPath] = createMainEntrypoint({
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
            target: target === 'webworker' ? target : 'web',
            externalFeatures,
        });
        if (target === 'web' || target === 'electron-renderer') {
            plugins.push(
                new HtmlWebpackPlugin({
                    filename: `${envName}.html`,
                    chunks: [envName],
                    title,
                })
            );
        }
    }
    const { plugins: basePlugins = [] } = baseConfig;

    return {
        ...baseConfig,
        target,
        entry,
        mode,
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            ...baseConfig.output,
            path: outputPath,
            filename: `[name].${target}.js`,
            chunkFilename: `[name].${target}.js`,
        },
        plugins: [...basePlugins, ...plugins],
    };
}

export function createWebpackConfigForExteranlFeature({
    baseConfig,
    target,
    enviroments,
    virtualModules,
    features,
    context,
    mode = 'development',
    outputPath,
    plugins = [],
    entry = {},
    featureName,
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const externals: Record<string, string> = {
        '@wixc3/engine-core': 'EngineCore',
    };
    for (const feature of [...features.values()]) {
        if (feature.isRoot && (!featureName || featureName === feature.scopedName)) {
            for (const [envName, childEnvs] of enviroments) {
                const entryPath = fs.join(context, `${envName}.js`);
                entry[envName] = entryPath;
                const publicPathParts = [EXTERNAL_FEATURES_BASE_URI, feature.packageName];
                if (feature.scopedName !== feature.name) {
                    publicPathParts.push(feature.name);
                }
                publicPathParts.push(basename(outputPath) + '/');
                virtualModules[entryPath] = createExternalBrowserEntrypoint({
                    ...feature,
                    childEnvs,
                    envName,
                    publicPath: join(...publicPathParts),
                    loadStatement: webpackImportStatement,
                    target: target === 'webworker' ? 'webworker' : 'web',
                });
            }
        } else {
            if (feature.packageName !== '@wixc3/engine-core') {
                const featureFilePath = remapFileRequest(feature);
                externals[featureFilePath] =
                    LOADED_FEATURE_MODULES_NAMESPACE +
                    '.' +
                    feature.packageName.replace('@', '').replace(/\//g, '').replace(/-/g, '') +
                    '_' +
                    feature.exportedFeature.id;
            }
        }
    }
    const { packageName, name } = features.get(featureName!)!;
    const { plugins: basePlugins = [] } = baseConfig;
    return {
        ...baseConfig,
        target,
        entry,
        mode,
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            ...baseConfig.output,
            path: outputPath,
            filename: `[name].${target}.js`,
            chunkFilename: `[name].${target}.js`,
            libraryTarget: 'var',
            jsonpFunction: packageName + name,
        },
        plugins: [...basePlugins, ...plugins],
        externals,
        optimization: {
            ...baseConfig.optimization,
            moduleIds: 'named',
        },
    };
}
