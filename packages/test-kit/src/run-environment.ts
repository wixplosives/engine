import { RuntimeEngine, type AnyEnvironment, type FeatureClass, type Running } from '@wixc3/engine-core';
import { getRunningFeature as originalGetRunningFeature, type RunningFeatureOptions } from '@wixc3/engine-scripts';
import { disposeAfter } from '@wixc3/testing';

/**
 * get a running feature with no browser environment
 * @param disposeAfterTestTimeout if false, will not dispose the engine after the test
 */
export async function getRunningFeature<F extends FeatureClass, ENV extends AnyEnvironment>(
    options: RunningFeatureOptions<F, ENV>,
    disposeAfterTestTimeout: false | number = 10_000,
): Promise<{
    runningApi: Running<F, ENV>;
    engine: RuntimeEngine;
    /**@deprecated use engine.shutdown */
    dispose: () => Promise<void>;
}> {
    const runningFeature = await originalGetRunningFeature(options);
    if (disposeAfterTestTimeout) {
        disposeAfter(runningFeature.engine.shutdown, {
            name: `engine shutdown for ${options.featureName}`,
            timeout: disposeAfterTestTimeout,
        });
    }

    return runningFeature;
}
