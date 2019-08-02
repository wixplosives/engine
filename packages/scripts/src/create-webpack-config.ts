import fs from '@file-services/node';
import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';
import { createEntrypoint } from './create-entrypoint';
import { inOwnRepo } from './own-repo-hook';
import { WebpackWorkerPlugin } from './webpack-worker-plugin';
import { join } from 'path';

export interface ICreateBundleConfigOptions {
    featureName?: string;
    configName?: string;
    features: Map<string, IFeatureDefinition>;
    context: string;
    mode?: 'production' | 'development';
    outputPath: string;
    enviroments: IEnvironment[];
    publicPath?: string;
}

export function createBundleConfig(options: ICreateBundleConfigOptions): webpack.Configuration {
    const {
        enviroments,
        mode = 'development',
        context,
        outputPath,
        publicPath,
        features,
        featureName,
        configName
    } = options;

    const virtualModules: Record<string, string> = {};
    const plugins: webpack.Plugin[] = [
        new HtmlWebpackPlugin({
            filename: `main.html`
        }),
        new StylableWebpackPlugin(),
        new VirtualModulesPlugin(virtualModules)
    ];
    const entry: webpack.Entry = {};
    for (const { type, name: envName, childEnvName } of enviroments) {
        const entryPath = fs.join(context, `${envName}-${type}-entry.js`);
        virtualModules[entryPath] = createEntrypoint({
            features,
            childEnvName,
            envName,
            featureName,
            configName
        });
        if (type === 'iframe' || type === 'window') {
            entry[envName] = entryPath;
        } else if (type === 'worker') {
            plugins.push(
                new WebpackWorkerPlugin({
                    id: envName,
                    entry: entryPath,
                    filename: `${envName}-webworker.js`,
                    chunkFilename: '[name]-webworker.js'
                })
            );
        } else {
            throw new Error(`environment "${envName}" has unknown type to bundle: ${type}`);
        }
    }

    return {
        entry,
        mode,
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            path: outputPath,
            chunkFilename: `[name].web.js`,
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

export const engineDashboardCongig = (): webpack.Configuration => {
    return {
        entry: join(__dirname, 'engine-start-app', 'main-page')
    }
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
