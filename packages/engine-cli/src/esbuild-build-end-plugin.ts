import { Plugin, BuildResult } from 'esbuild';

/** we found no other sensible way to know esbuild finished building in watch mode */
export function createBuildEndPluginHook() {
    let buildEndPromise: Promise<void> | undefined;
    const status = new Set<(status: 'start' | 'end', result?: BuildResult<{ metafile: true }>) => void>();
    let building = false;
    const plugin: Plugin = {
        name: 'build-end-plugin',
        setup(build) {
            build.onStart(() => {
                building = true;
                status.forEach((cb) => cb('start'));
            });
            build.onEnd((result) => {
                building = false;
                status.forEach((cb) => cb('end', result));
            });

            buildEndPromise = new Promise((res, rej) => {
                build.onEnd(({ errors }) => (errors.length ? rej(errors) : res()));
            });
        },
    };

    return {
        status,
        buildEndPlugin: plugin,
        waitForBuildEnd: () => {
            if (!buildEndPromise) {
                throw new Error('build is not started');
            }
            return buildEndPromise;
        },
        waitForRebuild: (cb: () => void) => {
            if (building) {
                const handler = () => {
                    cb();
                    status.delete(handler);
                };
                status.add(handler);
            }
            return building;
        },
    };
}
