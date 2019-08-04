import fs from '@file-services/node';
import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';
import { createEntrypoint } from './create-entrypoint';
import { inOwnRepo } from './own-repo-hook';

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
    const { enviroments } = options;
    const configurations: webpack.Configuration[] = [];
    const virtualModules: Record<string, string> = {};

    const webEnvs = enviroments.filter(({ type }) => type === 'window' || type === 'iframe');
    const workerEnvs = enviroments.filter(({ type }) => type === 'worker');
    if (webEnvs.length) {
        configurations.push(
            createWebpackConfig({
                ...options,
                enviroments: webEnvs,
                target: 'web',
                virtualModules,
                plugins: [new VirtualModulesPlugin(virtualModules), new StylableWebpackPlugin()]
            })
        );
    }
    if (workerEnvs.length) {
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
    enviroments: IEnvironment[];
    publicPath?: string;
    target: 'web' | 'webworker';
    virtualModules: Record<string, string>;
    plugins?: webpack.Plugin[];
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
    plugins = []
}: ICreateWebpackConfigOptions): webpack.Configuration {
    const entry: webpack.Entry = {};
    for (const { type: envType, name: envName, childEnvName } of enviroments) {
        const entryPath = fs.join(context, `${envName}-${envType}-entry.js`);
        entry[envName] = entryPath;
        virtualModules[entryPath] = createEntrypoint({
            features,
            childEnvName,
            envName,
            featureName,
            configName
        });
        if (target === 'web') {
            plugins.push(
                new HtmlWebpackPlugin({
                    filename: `${envName}.html`,
                    chunks: [envName],
                    // line below must be removed. it causes chrome to load the page
                    // with css quirks mode
                    templateContent: ``
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
            rules: [typescriptLoader, cssLoader, assetLoader],
            // the simplest way to bundle typescript without warnings, as it uses dynamic require calls
            noParse: [/typescript[\\/]lib[\\/]typescript\.js$/]
        },
        plugins
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
