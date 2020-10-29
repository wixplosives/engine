import fs from '@file-services/node';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    createExternalNodeEntrypoint,
    nodeImportStatement,
    remapFileRequest,
    webpackImportStatement,
} from './create-entrypoint';
import type { IEnvironment, IFeatureDefinition, IConfigDefinition, TopLevelConfigProvider } from './types';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: webpack.Configuration;
    featureName?: string;
    configName?: string;
    singleFeature?: boolean;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    enviroments: IEnvironment[];
    publicPath?: string;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: typeof createWebpackConfig;
    external: boolean;
}

function getAllResolvedContexts(features: Map<string, IFeatureDefinition>) {
    const allContexts = new SetMultiMap<string, string>();
    for (const { resolvedContexts } of features.values()) {
        convertEnvRecordToSetMultiMap(resolvedContexts, allContexts);
    }
    return allContexts;
}

function convertEnvRecordToSetMultiMap(record: Record<string, string>, set = new SetMultiMap<string, string>()) {
    for (const [env, resolvedContext] of Object.entries(record)) {
        set.add(env, resolvedContext);
    }
    return set;
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const {
        enviroments,
        baseConfig = {},
        publicPath = '',
        featureName,
        features,
        singleFeature,
        createWebpackConfig,
        external,
    } = options;

    const resolvedContexts =
        featureName && singleFeature
            ? convertEnvRecordToSetMultiMap(features.get(featureName)?.resolvedContexts ?? {})
            : getAllResolvedContexts(features);

    if (!baseConfig.output) {
        baseConfig.output = {};
    }
    baseConfig.output.publicPath = publicPath;
    const configurations: webpack.Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    const webEnvs = new Map<string, string[]>();
    const workerEnvs = new Map<string, string[]>();
    const electronRendererEnvs = new Map<string, string[]>();
    const nodeEnvs = new Map<string, string[]>();
    for (const env of enviroments) {
        const { type, name, childEnvName } = env;
        if (!resolvedContexts.hasKey(name) || (childEnvName && resolvedContexts.get(name)?.has(childEnvName)))
            if (type === 'window' || type === 'iframe') {
                addEnv(webEnvs, env);
            } else if (type === 'worker') {
                addEnv(workerEnvs, env);
            } else if (type === 'electron-renderer') {
                addEnv(electronRendererEnvs, env);
            } else if (external && type === 'node') {
                addEnv(nodeEnvs, env);
            }
    }
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
            })
        );
    }
    if (external && nodeEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: nodeEnvs,
                target: 'node',
                virtualModules,
                plugins: [new VirtualModulesPlugin(virtualModules)],
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
    target: 'web' | 'webworker' | 'electron-renderer' | 'node';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
    entry?: webpack.Entry;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
}

function addEnv(envs: Map<string, string[]>, { name, childEnvName }: IEnvironment) {
    const childEnvs = envs.get(name) || [];
    if (childEnvName) {
        childEnvs.push(childEnvName);
    }
    envs.set(name, childEnvs);
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
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const externals: Record<string, string> = {
        '@wixc3/engine-core': 'EngineCore',
    };
    for (const feature of [...features.values()]) {
        if (feature.isRoot) {
            for (const [envName, childEnvs] of enviroments) {
                const entryPath = fs.join(context, `${envName}.js`);
                const createEntrypoint =
                    target === 'node' ? createExternalNodeEntrypoint : createExternalBrowserEntrypoint;
                entry[envName] = entryPath;

                virtualModules[entryPath] = createEntrypoint({
                    ...feature,
                    childEnvs,
                    envName,
                    publicPath: './',
                    loadStatement: target === 'node' ? nodeImportStatement : webpackImportStatement,
                });
            }
        } else {
            if (feature.packageName !== '@wixc3/engine-core') {
                const featureFilePath = remapFileRequest(feature);
                externals[featureFilePath] = feature.exportedFeature.id;
            }
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
            libraryTarget: 'umd',
        },
        plugins: [...basePlugins, ...plugins],
        externals,
    };
}
