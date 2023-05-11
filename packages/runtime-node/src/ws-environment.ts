import type io from 'socket.io';

import { StartEnvironmentOptions, WsServerHost } from '@wixc3/engine-core-node';

import { runNodeEnvironment } from './node-environment';

export function runWSEnvironment(socketServer: io.Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const socketServerNamespace = socketServer.of(startEnvironmentOptions.name);
    const wsHost = new WsServerHost(socketServerNamespace);

    return {
        start: async () => {
            const engine = await runNodeEnvironment({
                ...startEnvironmentOptions,
                host: wsHost,
            });

            return {
                runtimeEngine: engine,
                close: async () => {
                    wsHost.dispose();
                    await engine.shutdown();
                },
                host: wsHost,
            };
        },
    };
}
