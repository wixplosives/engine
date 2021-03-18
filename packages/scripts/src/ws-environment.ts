import type { Server } from 'socket.io';

import { WsServerHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';

export function runWSEnvironment(socketServer: Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const { name } = startEnvironmentOptions;
    const socketServerNamespace = socketServer.of(name);

    return {
        start: async () => {
            const runtimeEngine = await runNodeEnvironment(startEnvironmentOptions);
            const {
                api: { communication },
            } = runtimeEngine.engine.getCOM();
            const wsHost = new WsServerHost(socketServerNamespace, communication);
            communication.registerMessageHandler(wsHost);
            return {
                runtimeEngine: runtimeEngine.engine,
                close: async () => {
                    wsHost.dispose();
                    await runtimeEngine.dispose();
                },
            };
        },
    };
}
