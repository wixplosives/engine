const { StylableWebpackPlugin } = require('@stylable/webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    context: __dirname,
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                type: 'asset',
            },
        ],
    },
    plugins: [new StylableWebpackPlugin()],
};
