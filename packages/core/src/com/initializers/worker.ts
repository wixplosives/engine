import type { EnvironmentInitializer } from '../types';

export function workerInitializer(): EnvironmentInitializer<{ id: string }> {
    return async (communication, { env, endpointType }) => {
        const isSingleton = endpointType === 'single';
        const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);

        const workerUrl = new URL(`${communication.getPublicPath()}${env}.webworker.js`, location.href);
        const workerBlob = new Blob(
            [
                `self.parentLocationHref = ${JSON.stringify(location.href)};`,
                `self.parentLocationSearch = ${JSON.stringify(location.search)};`,
                `importScripts(${JSON.stringify(workerUrl)});`,
            ],
            {
                type: 'application/javascript',
            }
        );
        const blobUrl = URL.createObjectURL(workerBlob);
        const worker = new Worker(blobUrl, {
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
