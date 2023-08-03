import { BaseHost, Message } from '@wixc3/engine-core';
import type { WebContents, IpcMain, IpcMainEvent } from 'electron';

/**
 * Communication host for the electron-main process
 */
export class ElectronBrowserHost extends BaseHost {
    constructor(
        private host: IpcMain,
        private webContents: WebContents,
    ) {
        super();
        this.host.on('message', this.onMessage);
    }

    private onMessage = (_: IpcMainEvent, data: Message): void => {
        this.emitMessageHandlers(data);
    };

    postMessage(message: unknown): void {
        this.webContents.send('message', message);
    }

    dispose(): void {
        this.host.off('message', this.onMessage);
    }
}
