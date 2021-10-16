const { StylableWebpackPlugin } = require('@stylable/webpack-plugin');

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
                exclude: /node_modules/,
            },
            {
                test: /\.tsx?$/,
                loader: '@ts-tools/webpack-loader',
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                type: 'asset',
            },
        ],
    },
    plugins: [new StylableWebpackPlugin()],
};
