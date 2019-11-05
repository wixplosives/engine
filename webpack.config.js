const { join } = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const {StylableWebpackPlugin} = require('@stylable/webpack-plugin');

module.exports = {
    resolve: {
        extensions: ['.ts', '.tsx', '.mjs', '.js', '.json'],
        plugins: [new TsconfigPathsPlugin({ configFile: join(__dirname, 'tsconfig.json') })]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /\.d\.ts$/,
                loader: '@ts-tools/webpack-loader'
            },
            {
                test: /\.css$/,
                exclude: /\.st\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|gif|svg)$/i,
                loader: 'url-loader',
                options: {
                    limit: 2048
                }
            }
        ]
    },
    plugins: [
        new StylableWebpackPlugin()
    ]
};
