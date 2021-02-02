import type { EnvironmentInitializer } from '../types';

export function workerInitializer(): EnvironmentInitializer<{ id: string }> {
    return async (communication, { env, endpointType }) => {
        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);

        const worker = new Worker(`${communication.getPublicPath()}${env}.webworker.js${location.search}`, {
            name: instanceId,
        });

        communication.registerMessageHandler(worker);
        communication.registerEnv(instanceId, worker);
        await communication.envReady(instanceId);
        return {
            id: instanceId,
        };
    };
}
