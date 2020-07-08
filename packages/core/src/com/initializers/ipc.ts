import type { EnvironmentInitializer } from '../types';

export function ipcInitializer(): EnvironmentInitializer<{ id: string }> {
    return async (communication, { env, endpointType }) => {
        const instanceId = communication.getEnvironmentInstanceId(env, endpointType);

        const host = communication.getEnvironmentHost(env);
        if (!host) {
            throw new Error(`IPC hosts should be registered and forked before the initializer run`);
        }

        communication.registerMessageHandler(host);
        await communication.envReady(env);

        return {
            id: instanceId,
        };
    };
}
