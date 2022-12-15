import { once } from '@wixc3/common';
import type { InitializerOptions } from '@wixc3/engine-core';
import { electronRuntimeArguments } from '@wixc3/engine-electron-commons';
import { BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';

import { ElectronBrowserHost } from '../hosts/electron-node-host';
import type { InitializedBrowserEnvironment, IWindowEnvironmentOptions } from './types';

export interface BrowserWindowEnvironmentInitializerOptions extends InitializerOptions {
    browserWindow: BrowserWindow;
}

/**
 * registers a message handler inside the electron main process, which will respond to communication messages coming from the `browserWindow`
 * @param browserWindow the browser winodow that requires communication with the main host
 */
export function windowEnvironmentInitializer({
    browserWindow,
    env: { env: envName },
    communication: com
}: BrowserWindowEnvironmentInitializerOptions): InitializedBrowserEnvironment {
    const host = new ElectronBrowserHost(ipcMain, browserWindow.webContents);
    com.registerEnv(envName, host);
    com.registerMessageHandler(host);
    return {
        id: envName,
        dispose: once(() => {
            host.dispose();
            com.clearEnvironment(envName);
            com.removeMessageHandler(host);
        }),
        browserWindow
    };
}

/**
 * openning a an engine environment in a browser window
 */
export async function initializeWindowEnvironment({
    env,
    browserWindow,
    runOptions,
    communication,
    configName = runOptions.get(electronRuntimeArguments.runtimeConfigName) as string | undefined,
    featureName = runOptions.get(electronRuntimeArguments.runtimeFeatureName) as string,
    runtimeArguments = {},
}: IWindowEnvironmentOptions): Promise<InitializedBrowserEnvironment> {
    const devport = runOptions.get(electronRuntimeArguments.devport) as string | undefined;

    const query = {
        feature: featureName,
        config: configName ?? '',
        ...runtimeArguments
    };
    if (devport) {
        const url = new URL(`http://localhost:${devport}/${env.env}.html`);
        for (const [name, val] of Object.entries(query)) {
            url.searchParams.set(name, val);
        }
        await browserWindow.loadURL(url.toString());
    } else {
        const basePath = runOptions.get(electronRuntimeArguments.outPath) as string;
        const htmlPath = join(basePath, `${env.env}.html`);
        await browserWindow.loadFile(htmlPath, { query });
    }

    if (runOptions.get(electronRuntimeArguments.devtools)) {
        browserWindow.webContents.openDevTools({ mode: 'bottom' });
    }

    const activeEnvironment = windowEnvironmentInitializer({ env, browserWindow, communication });
    return activeEnvironment;
}
