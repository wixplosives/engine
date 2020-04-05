const webpack = require('webpack');
const path = require('path');
const baseWebpackConfig = require('../../webpack.config');

function getConfigForMode(mode) {
    return {
        ...baseWebpackConfig,
        mode,
        entry: path.join(__dirname, 'src'),
        output: {
            library: 'EngineCore',
            libraryTarget: 'umd',
            path: path.join(__dirname, 'umd'),
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
        process.exit(1);
    }
    console.log(stats.toString({ colors: true }));
    if (stats.hasErrors()) {
        process.exit(1);
    }
});
