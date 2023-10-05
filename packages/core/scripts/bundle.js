import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import baseWebpackConfig from '../../../webpack.config.js';

const entryPath = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const outputPath = fileURLToPath(new URL('../dist/umd', import.meta.url));

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
