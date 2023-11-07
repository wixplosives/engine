import { Plugin } from 'esbuild';

/** we found no other sensible way to know esbuild finished building in watch mode */
export function createBuildEndPluginHook() {
    let buildEndPromise: Promise<void> | undefined;

    const plugin: Plugin = {
        name: 'build-end-plugin',
        setup(build) {
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
    };
}
