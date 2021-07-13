import type { SocketOptions } from 'socket.io-client';
import type { Environment } from '../../entities';
import type { Communication } from '../communication';
import { WsClientHost } from '../hosts/ws-client-host';
import type { ReadyMessage } from '../message-types';

export const socketServerInitializer = async (
    communication: Communication,
    { env }: Environment,
    options?: Partial<SocketOptions>
) => {
    const url = communication.topology[env];
    if (!url) {
        throw new Error(`Could not find node topology for ${env} environment`);
    }
    const instanceId = env;
    const host = new WsClientHost(url, options);
    if (communication.getEnvironmentHost(instanceId)) {
        communication.clearEnvironment(instanceId);
    }
    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    await host.connected;
    communication.handleReady({ from: instanceId } as ReadyMessage);

    return {
        id: instanceId,
        onDisconnect: (cb: () => void) => {
            host.subscribers.listeners.add('disconnect', cb);
        },
        onReconnect: (cb: () => void) => {
            host.subscribers.listeners.add('reconnect', cb);
        },
    };
};
