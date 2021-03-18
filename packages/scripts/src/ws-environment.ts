import type { Server } from 'socket.io';

import { WsServerHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';

export function runWSEnvironment(socketServer: Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const { name, host } = startEnvironmentOptions;
    const socketServerNamespace = socketServer.of(name);

    return {
        start: async () => {
            const wsHost = new WsServerHost(socketServerNamespace);

            const runtimeEngine = await runNodeEnvironment({ ...startEnvironmentOptions, host });
            const {
                api: { communication },
            } = runtimeEngine.engine.getCOM();
            communication.registerMessageHandler(wsHost);
            wsHost.addEventListener('message', ({ data: { from } }) => {
                if (!communication.getEnvironmentHost(from)) {
                    communication.registerEnv(from, wsHost);
                }
            });

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
