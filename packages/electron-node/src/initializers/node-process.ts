import { EnvironmentInitializer, IActiveEnvironment } from '@wixc3/engine-core';
import { getApplicationMetaData } from '@wixc3/engine-core-node';
import { InitializeNodeEnvironmentOptions, initializeNodeEnvironment } from '@wixc3/engine-electron-commons';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */
export const initializeNodeEnvironmentInNode: EnvironmentInitializer<
    Promise<IActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'runtimeArguments'>
> = async (options) => {
    const runtimeArguments = await getApplicationMetaData(options.communication);
    const { id, dispose, onExit, environmentIsReady } = initializeNodeEnvironment({
        runtimeArguments,
        ...options,
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on('exit', dispose);

    await environmentIsReady;

    return { id, onExit };
};
