const { StylableWebpackPlugin } = require('@stylable/webpack-plugin');
const ReactRefreshTypeScript = require('react-refresh-typescript');
const ReactRefreshPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    context: __dirname,
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader',
            },
            {
                test: /\.tsx?$/,
                loader: '@ts-tools/webpack-loader',
                options: {
                    transformers: {
                        before: [ReactRefreshTypeScript()],
                    },
                },
            },
        ],
    },
    plugins: [
        new StylableWebpackPlugin(),
        new ReactRefreshPlugin({
            overlay: {
                sockIntegration: 'whm',
            },
        }),
    ],
};
