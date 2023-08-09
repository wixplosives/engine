const webpack = require('webpack');
const path = require('path');
const baseWebpackConfig = require('../../../webpack.config');

const entryPath = require.resolve('../dist/index.js');
const outputPath = path.join(__dirname, '../dist/umd');

function getConfigForMode(mode) {
    return {
        ...baseWebpackConfig,
        mode,
        entry: entryPath,
        output: {
            library: 'EngineCore',
            libraryTarget: 'umd',
            path: outputPath,
            filename: mode === 'production' ? 'engine-core.min.js' : 'engine-core.js',
            globalObject: 'globalThis',
        },
        externals: {
            'socket.io-client': {
                commonjs: 'socket.io-client',
                commonjs2: 'socket.io-client',
                amd: 'socket.io-client',
                root: 'io',
            },
        },
    };
}

const compiler = webpack([getConfigForMode('development'), getConfigForMode('production')]);

compiler.run((e, stats) => {
    if (e) {
        console.error(e);
        process.exitCode = 1;
    }
    console.log(stats.toString({ colors: true }));
    if (stats.hasErrors()) {
        process.exitCode = 1;
    }
});
