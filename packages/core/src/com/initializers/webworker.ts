import type { InitializerOptions } from './types';

export async function webWorkerInitializer({ communication, env: { env, endpointType } }: InitializerOptions) {
    const isSingleton = endpointType === 'single';
    const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);

    const webWorker = new Worker(`${communication.getPublicPath()}${env}.webworker.js${location.search}`, {
        name: instanceId,
    });

    communication.registerMessageHandler(webWorker);
    communication.registerEnv(instanceId, webWorker);
    await communication.envReady(instanceId);
    return {
        id: instanceId,
    };
}
