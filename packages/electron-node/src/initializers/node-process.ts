import { type ActiveEnvironment, type EnvironmentInitializer } from '@wixc3/engine-core';
import { initializeNodeEnvironment, type InitializeNodeEnvironmentOptions } from '@wixc3/engine-electron-commons';
import { getMetaData } from '@wixc3/engine-runtime-node';
import { createDisposables } from '@wixc3/patterns';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */
export const initializeNodeEnvironmentInNode: EnvironmentInitializer<
    Promise<ActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'runtimeArguments'>
> = async (options) => {
    const disposables = createDisposables('initializeNodeEnvironmentInNode');

    const runtimeArguments = await getMetaData(options.communication);

    const { id, dispose, onExit, environmentIsReady } = initializeNodeEnvironment({
        runtimeArguments,
        ...options,
    });

    // a single dispose step ensures on exit events the dispose commands will be sent synchronously to other processes
    disposables.add({
        name: 'node-environment-dispose',
        timeout: 5_000,
        dispose,
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    process.on('exit', () => disposables.dispose());

    await environmentIsReady;

    return { id, onExit };
};
