import fs from '@file-services/node';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    remapFileRequest,
    webpackImportStatement,
    LOADED_FEATURE_MODULES_NAMESPACE,
} from './create-entrypoint';
import { basename, join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from './build-constants';

import type webpack from 'webpack';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import type { getResolvedEnvironments } from './utils/environments';
import type { IFeatureDefinition, IConfigDefinition, TopLevelConfigProvider, IExtenalFeatureDescriptor } from './types';

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
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: (options: ICreateWebpackConfigOptions) => webpack.Configuration;
    externalFeatures: IExtenalFeatureDescriptor[];
    fetchFeatures?: boolean;
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
    const virtualModules: Record<string, string> = {};

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
                externalFeatures: filterExternalFeatures(webEnvs, 'web'),
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
                externalFeatures: filterExternalFeatures(workerEnvs, 'webworker'),
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
                externalFeatures: filterExternalFeatures(workerEnvs, 'electron-renderer'),
            })
        );
    }

    return configurations;

    function filterExternalFeatures(
        envs: Map<string, string[]>,
        _target: 'web' | 'webworker' | 'electron-renderer'
    ): IExtenalFeatureDescriptor[] {
        return options.externalFeatures.map<IExtenalFeatureDescriptor>((descriptor) => ({
            ...descriptor,
            envEntries: Object.fromEntries(
                Object.entries(descriptor.envEntries).filter(([envName]) => envs.has(envName))
            ),
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
    target: 'web' | 'webworker' | 'electron-renderer';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
    entry?: webpack.Entry;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    externalFeatures: IExtenalFeatureDescriptor[];
    fetchFeatures?: boolean;
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
    fetchFeatures,
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
            fetchFeatures,
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
    const externalFeatures: Record<string, string> = {
        '@wixc3/engine-core': 'EngineCore',
    };
    for (const feature of [...features.values()]) {
        if (featureName === feature.scopedName) {
            for (const [envName, childEnvs] of enviroments) {
                const entryPath = fs.join(context, `${envName}-${target}-entry.js`);
                entry[envName] = entryPath;
                const publicPathParts = [EXTERNAL_FEATURES_BASE_URI, feature.packageName];
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
                externalFeatures[featureFilePath] = `${LOADED_FEATURE_MODULES_NAMESPACE}[${JSON.stringify(
                    `${feature.packageName}_${feature.exportedFeature.id}`
                )}]`;
            }
        }
    }
    const { packageName, name } = features.get(featureName!)!;
    const { plugins: basePlugins = [] } = baseConfig;
    const externals: webpack.ExternalsElement[] = [];
    externals.push(externalFeatures);

    const userExternals = baseConfig.externals;
    if (userExternals) {
        if (Array.isArray(userExternals)) {
            externals.push(...userExternals);
        } else {
            externals.push(userExternals);
        }
    }
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
