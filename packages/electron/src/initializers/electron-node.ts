import { ipcRenderer } from 'electron';
import { IEngineRuntimeArguments } from '@wixc3/engine-core-node';
import {
    communicationChannels,
    initializeNodeEnvironment,
    InitializeNodeEnvironmentOptions,
} from '@wixc3/engine-electron-commons';

import type { EnvironmentInitializer, ActiveEnvironment } from '@wixc3/engine-core';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */

export const initializeNodeEnvironmentInBrowser: EnvironmentInitializer<
    Promise<ActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'runtimeArguments'>
> = async ({ communication, env, environmentStartupOptions, processOptions }) => {
    const runtimeArguments = await getApplicationMetaData();
    const { id, dispose, onExit, environmentIsReady } = initializeNodeEnvironment({
        environmentStartupOptions,
        env,
        communication,
        runtimeArguments,
        processOptions,
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    window.addEventListener('beforeunload', dispose);

    await environmentIsReady;

    return { id, onExit };
};

async function getApplicationMetaData() {
    return ipcRenderer.invoke(communicationChannels.engineRuntimeArguments) as Promise<IEngineRuntimeArguments>;
}
