import fs from '@file-services/node';
import webpack, { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import semverLessThan from 'semver/functions/lt';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    webpackImportStatement,
    createExternalFeatureMapping,
} from './create-entrypoint';

import type { getResolvedEnvironments } from './utils/environments';
import type { IFeatureDefinition, IConfigDefinition, TopLevelConfigProvider } from './types';
import { WebpackScriptAttributesPlugin } from './webpack-html-attributes-plugins';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: Configuration;
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
        const plugins: webpack.WebpackPluginInstance[] = [new VirtualModulesPlugin(virtualModules)];
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
    virtualModules: Record<string, string>;
    plugins?: webpack.WebpackPluginInstance[];
    entry?: webpack.EntryObject;
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    externalFeaturesRoute: string;
    eagerEntrypoint?: boolean;
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
    externalFeaturesRoute,
    eagerEntrypoint,
    favicon,
}: ICreateWebpackConfigOptions): Configuration {
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
            target,
            externalFeaturesRoute,
            eagerEntrypoint,
        });
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
        stats: 'errors-warnings',
    };
}

export function createWebpackConfigForExternalFeature({
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
    const feature = features.get(featureName!);
    if (!feature) {
        throw new Error(`${featureName!} was not found after analyzing features`);
    }

    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(context, `${envName}-${target}-entry.js`);
        entry[envName] = entryPath;
        virtualModules[entryPath] = createExternalBrowserEntrypoint({
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
    const { packageName, name, filePath } = feature;

    const { plugins: basePlugins = [] } = baseConfig;

    const userExternals = baseConfig.externals;
    if (userExternals) {
        if (Array.isArray(userExternals)) {
            externals.push(...userExternals);
        } else {
            externals.push(userExternals);
        }
    }
    const virtualModulePaths = Object.keys(virtualModules);
    externals.push(extractExternals(filePath, virtualModulePaths));

    const webpackConfig: webpack.Configuration = {
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
        externals,
        optimization: {
            ...baseConfig.optimization,
            moduleIds: 'named',
        },
        stats: 'errors-warnings',
    };
    if (semverLessThan(webpack.version, '5.0.0')) {
        webpackConfig.output!.libraryTarget = 'var';
        (webpackConfig.output as { jsonpFunction: string }).jsonpFunction = packageName + name;
    }
    return webpackConfig;
}

const extractExternals = (featurePath: string, ignoredRequests: string[]) => (
    { context, request }: { context?: string; request?: string },
    cb: (e?: Error, target?: string) => void
) => {
    try {
        if (!request || !context || ignoredRequests.includes(request)) {
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
        cb(err);
    }
};
