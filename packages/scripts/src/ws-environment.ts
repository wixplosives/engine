import { Server } from 'socket.io';

import { WsServerHost } from '@wixc3/engine-core-node';

import { StartEnvironmentOptions } from './types';
import { runEnvironment } from './node-environment';

export async function runWSEnvironment(socketServer: Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const { name } = startEnvironmentOptions;
    const socketServerNamespace = socketServer.of(name);
    const host = new WsServerHost(socketServerNamespace);
    disposeHandlers.add(() => host.dispose());

    const { close } = await runEnvironment({ ...startEnvironmentOptions, host });
    disposeHandlers.add(() => close());
    return {
        close: async () => {
            for (const disposeHandler of [...disposeHandlers].reverse()) {
                await disposeHandler();
            }
        },
    };
}
