import { WsClientHost } from '../hosts/ws-client-host';
import type { ReadyMessage } from '../message-types';
import type { EnvironmentInitializer } from '../types';
type listenFn = (cb: () => void) => void;

export function socketServerInitializer(
    options?: SocketIOClient.ConnectOpts
): EnvironmentInitializer<{
    id: string;
    onDisconnect: listenFn;
    onReconnect: listenFn;
}> {
    return async (communication, { env }) => {
        const url = communication.topology[env];
        if (!url) {
            throw new Error(`Could not find node topology for ${env} environment`);
        }
        const instanceId = env;
        const host = new WsClientHost(url, options);
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
}
