import type { InitializerOptions } from './types.js';

export const ipcInitializer = async ({ communication, env: { env, endpointType } }: InitializerOptions) => {
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
