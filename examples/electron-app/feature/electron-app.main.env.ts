import { BaseHost, Communication, Environment } from '@wixc3/engine-core';
import { IpcRenderer, ipcRenderer } from 'electron';

import ElectronAppFeature, { main, server } from './electron-app.feature';
import { fork } from 'child_process';
import { IPCHost } from '@wixc3/engine-core-node/src';

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

ElectronAppFeature.setup(main, ({ run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(server, com => {
            const serverProcess = fork('../src/processing-entry.ts', [], {
                cwd: __dirname,
                execArgv: ['-r', '@ts-tools/node/r'],
                stdio: 'inherit'
            });

            const serverHost = new IPCHost(serverProcess);
            com.registerEnv('server', serverHost);
            com.registerMessageHandler(serverHost);

            return Promise.resolve({
                id: server.env
            });
        });
    });

    return null;
});
