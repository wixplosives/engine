import { BaseHost, Communication, type Message } from '@wixc3/engine-core';
import type { IpcRenderer, IpcRendererEvent } from 'electron';

/**
 * Communication host for the electron-renderer process
 */
export class ElectronClientHost extends BaseHost {
    constructor(private host: IpcRenderer) {
        super();
        this.host.on('message', this.onMessage);
    }

    private onMessage = (_: IpcRendererEvent, data: Message): void => {
        this.emitMessageHandlers(data);
    };

    postMessage(message: unknown): void {
        this.host.send('message', message);
    }

    dispose(): void {
        this.host.off('message', this.onMessage);
    }
}

/**
 * register the ipcRenderer protocol as a host for envName
 * @param envName name of the environment to register
 * @param communication runtime instance of current environment communication
 */
export function registerElectronHostEnvironment(
    ipcRenderer: IpcRenderer,
    envName: string,
    communication: Communication,
): BaseHost {
    const comHost = new ElectronClientHost(ipcRenderer);
    communication.registerEnv(envName, new ElectronClientHost(ipcRenderer));
    communication.registerMessageHandler(comHost);
    return comHost;
}
