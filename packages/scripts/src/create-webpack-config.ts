import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import { EnvironmentTypes } from '@wixc3/engine-core';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import { inOwnRepo } from './own-repo-hook';

export interface ICreateBundleConfigOptions {
    context: string;
    outputPath: string;
    entryName: string;
    entryPath: string;
    target: 'web' | 'webworker';
    mode?: 'production' | 'development';
    plugins?: webpack.Plugin[];
}

export function createBundleConfig(options: ICreateBundleConfigOptions): webpack.Configuration {
    const {
        mode = 'development',
        context,
        entryPath,
        target,
        entryName,
        outputPath,
        plugins: optionsPlugins = []
    } = options;
    const plugins = [...optionsPlugins, new StylableWebpackPlugin()];

    if (target === 'web') {
        plugins.push(
            new HtmlWebpackPlugin({
                filename: `${entryName}.html`
            })
        );
    }

    return {
        target,
        entry: { [entryName]: entryPath },
        mode,
        devtool: mode === 'development' ? 'source-map' : false,
        context,
        output: {
            path: outputPath,
            filename: `[name]-${target}.js`,
            chunkFilename: `${entryName}-[name]-${target}.js`
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

export function envTypeToBundleTarget(type: EnvironmentTypes) {
    switch (type) {
        case 'window':
        case 'iframe':
            return 'web';
        case 'worker':
            return 'webworker';
        case 'node':
        case 'context':
            throw new Error(`unhandled env type "${type}" for bundling`);
    }
}
