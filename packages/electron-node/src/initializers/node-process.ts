import { EnvironmentInitializer, IActiveEnvironment } from '@wixc3/engine-core';
import { createMetadataProvider } from '@wixc3/engine-core-node';
import { createDisposables } from '@wixc3/patterns';
import { InitializeNodeEnvironmentOptions, initializeNodeEnvironment } from '@wixc3/engine-electron-commons';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */
export const initializeNodeEnvironmentInNode: EnvironmentInitializer<
    Promise<IActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'runtimeArguments'>
> = async (options) => {
    const disposables = createDisposables();

    const metadataProvider = createMetadataProvider(options.communication);
    disposables.add(metadataProvider.dispose);

    const runtimeArguments = await metadataProvider.getMetadata();
    const { id, dispose, onExit, environmentIsReady } = initializeNodeEnvironment({
        runtimeArguments,
        ...options,
    });
    disposables.add(dispose);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on('exit', disposables.dispose);

    await environmentIsReady;

    return { id, onExit };
};
