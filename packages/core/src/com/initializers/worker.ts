import type { InitializerOptions } from './types';

export async function workerInitializer({ communication, env: { env, endpointType } }: InitializerOptions) {
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
}
