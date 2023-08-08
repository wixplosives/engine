import { BrowserWindow } from 'electron';
import { RUN_OPTIONS } from '@wixc3/engine-core';
import { initializeWindowEnvironment } from '@wixc3/engine-electron-node';
import ElectronApp, { host, renderer } from './electron-app.feature.js';

ElectronApp.setup(host, ({ run, [RUN_OPTIONS]: runOptions }, { COM: { communication } }) => {
    run(async () => {
        /**
         * Creating a browser window.
         * It's important for these 2 flags to be enabled, for communication purpuses
         */
        const window = new BrowserWindow({
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        });

        /**
         * Loading the renderer environment inside the browser window, and creating communication between the renderer and the process
         */
        await initializeWindowEnvironment({
            env: renderer,
            browserWindow: window,
            runOptions,
            communication,
        });
    });
});
