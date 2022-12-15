import type { SocketOptions } from 'socket.io-client';
import { WsClientHost } from '../hosts/ws-client-host';
import type { ReadyMessage } from '../message-types';
import type { InitializerOptions } from './types';

export interface SocketClientInitializerOptions extends InitializerOptions, Partial<SocketOptions> {}

export const socketClientInitializer = async ({
    communication,
    env: { env },
    ...socketClientOptions
}: SocketClientInitializerOptions) => {
    const url = communication.topology[env];
    if (!url) {
        throw new Error(`Could not find node topology for ${env} environment`);
    }
    const instanceId = env;
    const host = new WsClientHost(url, socketClientOptions);
    if (communication.getEnvironmentHost(instanceId)) {
        communication.clearEnvironment(instanceId, undefined, false);
    }
    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    await host.connected;
    communication.handleReady({ from: instanceId } as ReadyMessage);

    return {
        id: instanceId,
        onDisconnect: (cb: () => void) => {
            host.subscribers.on('disconnect', cb);
        },
        onReconnect: (cb: () => void) => {
            host.subscribers.on('reconnect', cb);
        },
    };
};
