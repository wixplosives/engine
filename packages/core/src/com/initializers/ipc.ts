import type { Environment } from '../../entities';
import type { Communication } from '../communication';

export const ipcInitializer = async (communication: Communication, { env, endpointType }: Environment) => {
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
