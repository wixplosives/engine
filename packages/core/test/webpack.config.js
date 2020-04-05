const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    context: __dirname,
    entry: {
        iframe: './iframe.ts',
        'delayed-iframe': './delayed-iframe.ts',
    },
    output: {
        filename: '[name].web.js',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: '@ts-tools/webpack-loader',
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: `iframe.html`,
            chunks: ['iframe'],
        }),
    ],
};
