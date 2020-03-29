import { BaseHost, Communication, Environment } from '@wixc3/engine-core';
import { IpcRenderer, ipcRenderer } from 'electron';

class ElectronClientHost extends BaseHost {
    constructor(private host: IpcRenderer) {
        super();
        this.host.on('message', (_, data) => {
            this.emitMessageHandlers(data);
        });
    }

    postMessage(message: any) {
        this.host.send('message', message);
    }
}

export const electronInitializer = async (com: Communication, { env }: Environment) => {
    const host = new ElectronClientHost(ipcRenderer);
    com.registerEnv(env, host);
    com.registerMessageHandler(host);
    return Promise.resolve({
        id: env
    });
};
