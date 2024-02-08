import { Loader, Plugin } from 'esbuild';

/** create virtual dynamic entry points for esbuild to bundle */
export function dynamicEntryPlugin({
    virtualEntryPoints,
    loader = 'tsx',
    entryPointsOnDisk,
}: {
    virtualEntryPoints: Map<string, string>;
    loader?: Loader;
    entryPointsOnDisk?: string[];
}) {
    const plugin: Plugin = {
        name: 'dynamic-entry',
        setup(build) {
            if (build.initialOptions.entryPoints) {
                throw new Error(`dynamicEntryPlugin: entryPoints must not be set when using dynamicEntryPlugin`);
            }

            if (entryPointsOnDisk) {
                build.initialOptions.entryPoints = entryPointsOnDisk;
                return;
            }

            build.initialOptions.entryPoints = Array.from(virtualEntryPoints.keys()).map((key) => `@@entry/${key}`);

            build.onResolve({ filter: /^@@entry/ }, (args) => {
                return {
                    path: args.path.replace(/^@@entry\//, ''),
                    namespace: 'dynamic-entry-ns',
                };
            });

            build.onLoad({ filter: /.*/, namespace: 'dynamic-entry-ns' }, (args) => {
                return {
                    resolveDir: '.',
                    loader,
                    contents: virtualEntryPoints.get(args.path),
                };
            });
        },
    };
    return plugin;
}
