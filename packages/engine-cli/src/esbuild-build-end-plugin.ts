import { Plugin } from 'esbuild';

export function createBuildEndPluginHook() {
    let buildEndPromise: Promise<void> | undefined;

    const plugin: Plugin = {
        name: 'raw-loader',
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
