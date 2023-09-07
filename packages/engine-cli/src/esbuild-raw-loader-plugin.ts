import fs from '@file-services/node';
import { createRequestResolver } from '@file-services/resolve';
import { Plugin } from 'esbuild';

/** handle webpack-style explicit raw-loader */
export function rawLoaderPlugin() {
    const plugin: Plugin = {
        name: 'raw-loader',
        setup(build) {
            const resolve = createRequestResolver({ fs, alias: build.initialOptions.alias });

            build.onResolve({ filter: /^raw-loader!/ }, (args) => {
                return {
                    path: resolve(args.importer, args.path.replace(/^raw-loader!/, '')).resolvedFile || args.path,
                    namespace: 'raw-loader-ns',
                };
            });
            build.onLoad({ filter: /.*/, namespace: 'raw-loader-ns' }, (args) => {
                const content = fs.readFileSync(args.path, 'utf8');
                return {
                    contents: `export default ${JSON.stringify(content)};`,
                    loader: 'js',
                };
            });
        },
    };
    return plugin;
}
