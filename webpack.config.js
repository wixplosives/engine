const { StylableWebpackPlugin } = require('@stylable/webpack-plugin');
const ReactRefreshTypeScript = require('react-refresh-typescript');

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
            {
                test: /\.css$/,
                exclude: /\.st\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                loader: 'url-loader',
                options: {
                    limit: 2048,
                },
            },
        ],
    },
    plugins: [new StylableWebpackPlugin()],
};
