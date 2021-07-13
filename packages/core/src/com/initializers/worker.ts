import type { Environment } from '../../entities';
import type { Communication } from '../communication';

export async function workerInitializer(communication: Communication, { env, endpointType }: Environment) {
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
