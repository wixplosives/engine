import type io from 'socket.io';
import { WsServerHost } from '@wixc3/engine-core-node';

import type { StartEnvironmentOptions } from './types';
import { runNodeEnvironment } from './node-environment';

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
            wsHost.addEventListener('message', ({ data: { from, origin } }) => {
                // we map both the from and the to, because we change mapping in the host itself, it re-mapps both the origin and the from, for multi-tenancy
                if (!communication.getEnvironmentHost(from)) {
                    communication.registerEnv(from, wsHost);
                }
                if (!communication.getEnvironmentHost(origin)) {
                    communication.registerEnv(origin, wsHost);
                }
            });

            return {
                runtimeEngine: runtimeEngine.engine,
                close: async () => {
                    wsHost.dispose();
                    await runtimeEngine.dispose();
                },
                host: wsHost,
            };
        },
    };
}
