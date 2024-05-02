import type { SocketOptions } from 'socket.io-client';
import { WsClientHost } from '../hosts/ws-client-host.js';
import type { InitializerOptions } from './types.js';

export interface SocketClientInitializerOptions extends InitializerOptions, Partial<SocketOptions> {}

export const socketClientInitializer = async ({
    communication,
    env: { env },
    ...socketClientOptions
}: SocketClientInitializerOptions) => {
    const url = communication.topology[env] || location.host;
    const instanceId = env;
    const host = new WsClientHost(url, socketClientOptions);
    if (communication.getEnvironmentHost(instanceId)) {
        communication.clearEnvironment(instanceId, undefined, false);
    }
    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    try {
        await host.connected;
    } catch (e) {
        communication.clearEnvironment(instanceId, undefined, false);
        void host.dispose();
        throw e;
    }

    communication.handleReady({ from: instanceId });

    return {
        id: instanceId,
        onDisconnect: (cb: () => void) => {
            host.subscribers.on('disconnect', cb);
        },
        onReconnect: (cb: () => void) => {
            host.subscribers.on('reconnect', cb);
        },
        dispose: () => {
            communication.clearEnvironment(instanceId, undefined, false);
            return host.dispose();
        },
    };
};
