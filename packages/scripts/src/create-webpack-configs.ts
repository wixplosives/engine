import fs from '@file-services/node';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import {
    createMainEntrypoint,
    createExternalBrowserEntrypoint,
    webpackImportStatement,
    createExternalFeatureMapping,
} from './create-entrypoint';
import { basename, join } from 'path';
import { EXTERNAL_FEATURES_BASE_URI } from './build-constants';

import type { ExternalsFunctionElement, Configuration, Plugin, Entry, ExternalsElement } from 'webpack';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import type { getResolvedEnvironments } from './utils/environments';
import type { IFeatureDefinition, IConfigDefinition, TopLevelConfigProvider, IExtenalFeatureDescriptor } from './types';
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
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    createWebpackConfig: (options: ICreateWebpackConfigOptions) => Configuration;
    externalFeatures: IExtenalFeatureDescriptor[];
    fetchFeatures?: boolean;
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): Configuration[] {
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
    const configurations: Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    if (webEnvs.size) {
        const plugins: Plugin[] = [new VirtualModulesPlugin(virtualModules)];
        const entry: Entry = {};
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
        target: 'web' | 'webworker' | 'electron-renderer'
    ): IExtenalFeatureDescriptor[] {
        return options.externalFeatures.map<IExtenalFeatureDescriptor>((descriptor) => ({
            ...descriptor,
            envEntries: Object.fromEntries(
                Object.entries(descriptor.envEntries).filter(
                    ([envName, envEntries]) => envs.has(envName) && !!envEntries[target]
                )
            ),
        }));
    }
}

interface ICreateWebpackConfigOptions {
    baseConfig: Configuration;
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
    plugins?: Plugin[];
    entry?: Entry;
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
            externalFeatures,
            fetchFeatures,
        });
        if (target === 'web' || target === 'electron-renderer') {
            plugins.push(
                ...[
                    new HtmlWebpackPlugin({
                        filename: `${envName}.html`,
                        chunks: [envName],
                        title,
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
}: ICreateWebpackConfigOptions): Configuration {
    const feature = features.get(featureName!);
    if (!feature) {
        throw new Error(`${featureName!} was not found after analyzing features`);
    }

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
    const externalFeatures: Record<string, string> = {
        '@wixc3/engine-core': 'EngineCore',
    };
    const externals: ExternalsElement[] = [externalFeatures];
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

const extractExternals: (featurePath: string, ignoredRequests: Array<string>) => ExternalsFunctionElement = (
    featurePath,
    ignoredRequests
) => (context, request, cb) => {
    try {
        if (ignoredRequests.includes(request)) {
            return cb();
        }
        const resolvedRequest = require.resolve(request, { paths: [context] });
        if (resolvedRequest !== featurePath && fs.basename(resolvedRequest).includes('.feature.')) {
            const packageJson = fs.findClosestFileSync(fs.dirname(resolvedRequest), 'package.json');
            if (!packageJson) {
                throw new Error(`could not find package.json for ${resolvedRequest}`);
            }
            const { name } = fs.readJsonFileSync(packageJson) as { name: string };
            return cb(null, createExternalFeatureMapping(name, resolvedRequest));
        }
        cb();
    } catch (err) {
        cb(err);
    }
};
