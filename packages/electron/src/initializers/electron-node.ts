import { ipcRenderer } from 'electron';
import {
    communicationChannels,
    IEngineRuntimeArguments,
    initializeNodeEnvironment,
    InitializeNodeEnvironmentOptions,
} from '@wixc3/engine-electron-commons';

import type { EnvironmentInitializer, IActiveEnvironment } from '@wixc3/engine-core';

/**
 * Spawn a node-based environment from the renderer process.
 * Should be invoked *only* from the renderer process.
 */

export const initializeNodeEnvironmentInBrowser: EnvironmentInitializer<
    Promise<IActiveEnvironment>,
    Omit<InitializeNodeEnvironmentOptions, 'getApplicationMetaData'>
> = async ({ communication, env, environmentStartupOptions, processOptions }) => {
    const { id, dispose, onDisconnect } = await initializeNodeEnvironment({
        environmentStartupOptions,
        env,
        communication,
        getApplicationMetaData,
        processOptions,
    });
    window.addEventListener('beforeunload', dispose);
    return { id, onDisconnect };
};

async function getApplicationMetaData() {
    return ipcRenderer.invoke(communicationChannels.engineRuntimeArguments) as Promise<IEngineRuntimeArguments>;
}
