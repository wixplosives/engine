const { StylableWebpackPlugin } = require('@stylable/webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    context: __dirname,
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: '@ts-tools/webpack-loader',
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
