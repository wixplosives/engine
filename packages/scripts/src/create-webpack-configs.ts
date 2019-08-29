import fs from '@file-services/node';
import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { createEntrypoint } from './create-entrypoint';
import { inOwnRepo } from './own-repo-hook';
import { IEnvironment, IFeatureDefinition } from './types';

export interface ICreateWebpackConfigsOptions {
    featureName?: string;
    configName?: string;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    enviroments: IEnvironment[];
    publicPath?: string;
}

export function createWebpackConfigs(options: ICreateWebpackConfigsOptions): webpack.Configuration[] {
    const { enviroments, mode = 'development' } = options;
    const configurations: webpack.Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    const webEnvs = new Map<string, string[]>();
    const workerEnvs = new Map<string, string[]>();
    for (const env of enviroments) {
        const { type } = env;
        if (type === 'window' || type === 'iframe') {
            addEnv(webEnvs, env);
        } else if (type === 'worker') {
            addEnv(workerEnvs, env);
        }
    }
    if (webEnvs.size) {
        const plugins: webpack.Plugin[] = [new VirtualModulesPlugin(virtualModules), new StylableWebpackPlugin()];
        const entry: webpack.Entry = {};
        if (mode === 'development') {
            plugins.push(
                new HtmlWebpackPlugin({
                    filename: `index.html`,
                    chunks: ['index']
                })
            );
            entry.index = require.resolve(fs.join(__dirname, 'engine-dashboard', 'index'));
        }
        configurations.push(
            createWebpackConfig({
                ...options,
                enviroments: webEnvs,
                target: 'web',
                virtualModules,
                plugins,
                entry
            })
        );
    }
    if (workerEnvs.size) {
        configurations.push(
            createWebpackConfig({
                ...options,
                enviroments: workerEnvs,
                target: 'webworker',
                virtualModules,
                plugins: [new VirtualModulesPlugin(virtualModules)]
            })
        );
    }

    return configurations;
}

interface ICreateWebpackConfigOptions {
    featureName?: string;
    configName?: string;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    enviroments: Map<string, string[]>;
    publicPath?: string;
    target: 'web' | 'webworker';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
    entry?: webpack.Entry;
}

function addEnv(envs: Map<string, string[]>, { name, childEnvName }: IEnvironment) {
    const childEnvs = envs.get(name) || [];
    if (childEnvName) {
        childEnvs.push(childEnvName);
    }
    envs.set(name, childEnvs);
}

function createWebpackConfig({
    target,
    enviroments,
    virtualModules,
    featureName,
    configName,
    features,
    context,
    mode = 'development',
    outputPath,
    publicPath,
    plugins = [],
    entry = {}
}: ICreateWebpackConfigOptions): webpack.Configuration {
    for (const [envName, childEnvs] of enviroments) {
        const entryPath = fs.join(context, `${envName}-${target}-entry.js`);
        entry[envName] = entryPath;
        virtualModules[entryPath] = createEntrypoint({
            features,
            childEnvs,
            envName,
            featureName,
            configName
        });
        if (target === 'web') {
            plugins.push(
                new HtmlWebpackPlugin({
                    filename: `${envName}.html`,
                    chunks: [envName]
                })
            );
        }
    }

    return {
        target,
        entry,
        mode,
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            path: outputPath,
            filename: `[name].${target}.js`,
            chunkFilename: `[name].${target}.js`,
            publicPath
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js'],
            alias: { '@wixc3/engine-core': inOwnRepo ? '@wixc3/engine-core/src' : '@wixc3/engine-core' }
        },
        module: {
            rules: [typescriptLoader, cssLoader, assetLoader]
        },
        plugins,
        externals: {
            // allows typescript to be bundled and run in web browsers
            'source-map-support': 'commonjs source-map-support',
            '@microsoft/typescript-etw': 'commonjs @microsoft/typescript-etw'
        }
    };
}

const typescriptLoader: webpack.RuleSetRule = {
    test: /\.tsx?$/,
    exclude: /\.d\.ts$/,
    loader: '@ts-tools/webpack-loader',
    options: {
        typeCheck: false
    }
};

const cssLoader: webpack.RuleSetRule = {
    test: /\.css$/,
    exclude: /\.st\.css$/,
    use: ['style-loader', 'css-loader']
};

const assetLoader: webpack.RuleSetRule = {
    test: /\.(png|jpg|gif|svg)$/i,
    loader: 'url-loader',
    options: {
        limit: 2048
    }
};
