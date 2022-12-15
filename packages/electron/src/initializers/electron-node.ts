import { ipcRenderer } from 'electron';
import {
    communicationChannels,
    IEngineRuntimeArguments,
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
    const { id, dispose, onDisconnect, environmentIsReady } = initializeNodeEnvironment({
        environmentStartupOptions,
        env,
        communication,
        runtimeArguments,
        processOptions,
    });
    window.addEventListener('beforeunload', dispose);

    await environmentIsReady;

    return { id, onDisconnect };
};

async function getApplicationMetaData() {
    return ipcRenderer.invoke(communicationChannels.engineRuntimeArguments) as Promise<IEngineRuntimeArguments>;
}
