import type io from 'socket.io';
import { WsServerHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';
import type { Communication, Message } from '@wixc3/engine-core';

export function runWSEnvironment(socketServer: io.Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const { host } = startEnvironmentOptions;
    const socketServerNamespace = socketServer.of(startEnvironmentOptions.name);
    const wsHost = new WsServerHost(socketServerNamespace);
    wsHost.parent = host;

    return {
        start: async () => {
            const runtimeEngine = await runNodeEnvironment({
                ...startEnvironmentOptions,
                host: wsHost,
            });
            const {
                api: { communication },
            } = runtimeEngine.engine.getCOM();
            if (host) {
                communication.registerMessageHandler(host);
            }
            const disposeCommunicationFromHost = createCommunicationWithHost(wsHost, communication);

            return {
                runtimeEngine: runtimeEngine.engine,
                close: async () => {
                    disposeCommunicationFromHost();
                    wsHost.dispose();
                    await runtimeEngine.dispose();
                },
                host: wsHost,
            };
        },
    };
}
export function createCommunicationWithHost(wsHost: WsServerHost, communication: Communication) {
    const messageHandler = ({ data: { from, origin } }: { data: Message }): void => {
        // we map both the from and the to, because we change mapping in the host itself, it re-mapps both the origin and the from, for multi-tenancy
        if (!communication.getEnvironmentHost(from)) {
            communication.registerEnv(from, wsHost);
        }
        if (!communication.getEnvironmentHost(origin)) {
            communication.registerEnv(origin, wsHost);
        }
    };
    wsHost.addEventListener('message', messageHandler);

    return () => wsHost.removeEventListener('message', messageHandler);
}
