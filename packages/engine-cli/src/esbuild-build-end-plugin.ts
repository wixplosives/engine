import { Plugin } from 'esbuild';

/** we found no other sensible way to know esbuild finished building in watch mode */
export function createBuildEndPluginHook() {
    let buildEndPromise: Promise<void> | undefined;
    const status = new Set<(status: 'start' | 'end') => void>();
    let building = false;
    const plugin: Plugin = {
        name: 'build-end-plugin',
        setup(build) {
            build.onStart(() => {
                building = true;
                status.forEach((cb) => cb('start'));
            });
            build.onEnd(() => {
                building = false;
                status.forEach((cb) => cb('end'));
            });

            buildEndPromise = new Promise((res, rej) => {
                build.onEnd(({ errors }) => (errors.length ? rej(errors) : res()));
            });
        },
    };

    return {
        buildEndPlugin: plugin,
        waitForBuildEnd: () => {
            if (!buildEndPromise) {
                throw new Error('build is not started');
            }
            return buildEndPromise;
        },
        waitForBuildReady: (cb: () => void) => {
            if (building) {
                status.add(() => {
                    cb();
                    status.delete(cb);
                });
            }
            return building;
        },
    };
}
