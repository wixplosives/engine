import { StylableWebpackPlugin } from '@stylable/webpack-plugin';
import { fileURLToPath } from 'node:url';

/** @type {import('webpack').Configuration} */
export default {
    context: fileURLToPath(new URL('.', import.meta.url)),
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
