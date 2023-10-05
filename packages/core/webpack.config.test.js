import HtmlWebpackPlugin from 'html-webpack-plugin';
import { fileURLToPath } from 'node:url';

/** @type {import('webpack').Configuration} */
export default {
    mode: 'development',
    context: fileURLToPath(new URL('.', import.meta.url)),
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
