import { RuntimeEngine, type AnyEnvironment, type FeatureClass, type Running } from '@wixc3/engine-core';
import { getRunningFeature as originalGetRunningFeature, type RunningFeatureOptions } from '@wixc3/engine-scripts';

/**
 * get a running feature with no browser environment
 * @param autoDisposeTimeout if false, will not dispose the engine after the test
 */
export async function getRunningFeature<F extends FeatureClass, ENV extends AnyEnvironment>(
    options: RunningFeatureOptions<F, ENV>,
    autoDisposeTimeout: false | number = 10_000,
): Promise<{
    runningApi: Running<F, ENV>;
    engine: RuntimeEngine;
    /**@deprecated use engine.shutdown */
    dispose: () => Promise<void>;
}> {
    const runningFeature = await originalGetRunningFeature(options);
    if (autoDisposeTimeout) {
        if (typeof afterEach !== 'undefined') {
            afterEach(`engine shutdown for ${options.featureName}`, function () {
                this.timeout(autoDisposeTimeout);
                return runningFeature.engine.shutdown();
            });
        } else {
            throw new Error(
                `autoDisposeTimeout is set but the environment you are running does not have global "afterEach", set it to false to avoid auto-dispose.`,
            );
        }
    }

    return runningFeature;
}
