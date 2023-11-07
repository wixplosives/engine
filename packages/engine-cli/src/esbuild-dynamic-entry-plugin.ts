import { Loader, Plugin } from 'esbuild';

/** create virtual dynamic entry points for esbuild to bundle */
export function dynamicEntryPlugin({
    entryPoints,
    loader = undefined,
}: {
    entryPoints: Map<string, string>;
    loader?: Loader;
}) {
    const plugin: Plugin = {
        name: 'dynamic-entry',
        setup(build) {
            if (build.initialOptions.entryPoints) {
                throw new Error(`dynamicEntryPlugin: entryPoints must not be set when using dynamicEntryPlugin`);
            }

            build.initialOptions.entryPoints = Array.from(entryPoints.keys()).map((key) => `@@entry/${key}`);

            build.onResolve({ filter: /^@@entry/ }, (args) => {
                return {
                    path: args.path.replace(/^@@entry\//, ''),
                    namespace: 'dynamic-entry-ns',
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'dynamic-entry-ns' }, (args) => {
                return {
                    resolveDir: '.',
                    loader: loader || 'tsx',
                    contents: entryPoints.get(args.path),
                };
            });
        },
    };
    return plugin;
}
