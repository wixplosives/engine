import fs from '@file-services/node';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { SetMultiMap } from '@wixc3/engine-core';
import { createEntrypoint } from './create-entrypoint';
import { IEnvironment, IFeatureDefinition, IConfigDefinition } from './types';

export interface ICreateWebpackConfigsOptions {
    baseConfig?: webpack.Configuration;
    featureName?: string;
    configName?: string;
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
}

const engineDashboardEntry = require.resolve('./engine-dashboard');

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const { enviroments, mode = 'development', baseConfig = {}, publicPath = '', featureName, features } = options;
    const resolvedContexts = featureName ? features.get(featureName)?.resolvedContexts ?? {} : {};
    if (!baseConfig.output) {
        baseConfig.output = {};
    }
    baseConfig.output.publicPath = publicPath;
    const configurations: webpack.Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    const webEnvs = new Map<string, string[]>();
    const workerEnvs = new Map<string, string[]>();
    const electronRendererEnvs = new Map<string, string[]>();
    const electronMainEnvs = new Map<string, string[]>();
    for (const env of enviroments) {
        const { type, name, childEnvName } = env;
        if (!resolvedContexts[name] || resolvedContexts[name] === childEnvName)
            if (type === 'window' || type === 'iframe') {
                addEnv(webEnvs, env);
            } else if (type === 'worker') {
                addEnv(workerEnvs, env);
            } else if (type === 'electron-renderer') {
                addEnv(electronRendererEnvs, env);
            } else if (type === 'electron-main') {
                addEnv(electronMainEnvs, env);
            }
    }
    if (webEnvs.size) {
        const plugins: webpack.Plugin[] = [new VirtualModulesPlugin(virtualModules)];
        const entry: webpack.Entry = {};
        if (mode === 'development') {
            plugins.push(
                new HtmlWebpackPlugin({
                    filename: `index.html`,
                    chunks: ['index'],
                })
            );
            entry.index = engineDashboardEntry;
        }
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

    if (electronMainEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                baseConfig,
                enviroments: electronRendererEnvs,
                target: 'electron-main',
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
    target: 'web' | 'webworker' | 'electron-renderer' | 'electron-main';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
    entry?: webpack.Entry;
    title?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
}

function addEnv(envs: Map<string, string[]>, { name, childEnvName }: IEnvironment) {
    const childEnvs = envs.get(name) || [];
    if (childEnvName) {
        childEnvs.push(childEnvName);
    }
    envs.set(name, childEnvs);
}

function createWebpackConfig({
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
}: ICreateWebpackConfigOptions): webpack.Configuration {
    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(context, `${envName}-${target}-entry.js`);
        entry[envName] = entryPath;
        virtualModules[entryPath] = createEntrypoint({
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
