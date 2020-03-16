import { WsClientHost } from '../ws-client-host';
import { ReadyMessage } from '../message-types';
import { EnvironmentInitializer } from '../types';

export function socketServerInitializer(): EnvironmentInitializer {
    return async (communication, { env }) => {
        const url = communication.topology[env];
        if (!url) {
            throw new Error(`Could not find node topology for ${env} environment`);
        }
        const instanceId = env;
        const host = new WsClientHost(url);
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
            }
        };
    };
}
