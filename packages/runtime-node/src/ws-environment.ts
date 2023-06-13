import type io from 'socket.io';

import { WsServerHost } from './core-node/ws-node-host';

import { runNodeEnvironment } from './node-environment';
import { StartEnvironmentOptions } from './types';

export function runWSEnvironment(socketServer: io.Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const socketServerNamespace = socketServer.of(startEnvironmentOptions.name);
    const wsHost = new WsServerHost(socketServerNamespace);

    return {
        start: async () => {
            try {
                const engine = await runNodeEnvironment({
                    ...startEnvironmentOptions,
                    host: wsHost,
                });

                return {
                    engine,
                    close: async () => {
                        wsHost.dispose();
                        await engine.shutdown();
                    },
                    host: wsHost,
                };
            } catch (e) {
                wsHost.dispose();
                throw e;
            }
        },
    };
}
