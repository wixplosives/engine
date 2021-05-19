import fs from '@file-services/node';
import webpack, { Configuration } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
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
    webpackHot?: boolean;
    entryTempDir: string;
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

    const tempEntryModules: Record<string, string> = {};

    const configurations: webpack.Configuration[] = [];

    if (webEnvs.size) {
        const entry: webpack.Entry = {};
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: webEnvs,
                target: 'web',
                entry,
                tempEntryModules,
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
                tempEntryModules,
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
                tempEntryModules,
            })
        );
    }

    for (const [fileName, content] of Object.entries(tempEntryModules)) {
        fs.writeFileSync(fileName, content);
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
    entry?: webpack.EntryObject;
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    externalFeaturesRoute: string;
    eagerEntrypoint?: boolean;
    webpackHot?: boolean;
    entryTempDir: string;
    tempEntryModules: Record<string, string>;
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
    webpackHot = false,
    entryTempDir,
    tempEntryModules,
}: ICreateWebpackConfigOptions): Configuration {
    const plugins: webpack.WebpackPluginInstance[] = [];
    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(entryTempDir, `${envName}-${target}-entry.js`);
        const config = typeof overrideConfig === 'function' ? overrideConfig(envName) : overrideConfig;
        entry[envName] = entryPath;
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

        tempEntryModules[entryPath] = entrypointContent;
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
        if (webpackHot) {
            // we need the hot middleware client into the env entry
            entry[envName] = ['webpack-hot-middleware/client', entryPath];
            plugins.push(new webpack.HotModuleReplacementPlugin());
        }
    }
    const { plugins: basePlugins = [] } = baseConfig;

    return {
        ...baseConfig,
        target,
        entry,
        name: target,
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
        watchOptions: {
            ignored: [entryTempDir],
        },
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
    entry = {},
    featureName,
    entryTempDir,
    tempEntryModules,
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const feature = features.get(featureName!);
    if (!feature) {
        throw new Error(`${featureName!} was not found after analyzing features`);
    }

    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(entryTempDir, `${envName}-${target}-entry.js`);
        entry[envName] = entryPath;
        tempEntryModules[entryPath] = createExternalBrowserEntrypoint({
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

    const userExternals = baseConfig.externals;
    if (userExternals) {
        if (Array.isArray(userExternals)) {
            externals.push(...userExternals);
        } else {
            externals.push(userExternals);
        }
    }
    const extractExternalsMethod = extractExternals(filePath, Object.keys(tempEntryModules));

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
