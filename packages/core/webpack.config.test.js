const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'development',
    context: __dirname,
    entry: {
        iframe: './dist/test/iframe.js',
        'delayed-iframe': './dist/test/delayed-iframe.js',
    },
    output: {
        filename: '[name].web.js',
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: `iframe.html`,
            chunks: ['iframe'],
        }),
        new HtmlWebpackPlugin({
            filename: `delayed-iframe.html`,
            chunks: ['delayed-iframe'],
        }),
    ],
};
