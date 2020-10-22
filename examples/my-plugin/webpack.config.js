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
                test: /\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader',
            },
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
    output: {
        libraryTarget: 'umd',
    },
    externals: {
        '@wixc3/engine-core': 'EngineCore',
        '@example/playground/src/code-editor/code-editor.feature': 'CodeEditor',
        '@example/playground/src/preview/compiler.feature': 'Compiler',
    },
};
