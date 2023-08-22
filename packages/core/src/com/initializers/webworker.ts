import { Worker } from '@wixc3/isomorphic-worker/worker';
import type { UniversalWorkerOptions } from '@wixc3/isomorphic-worker/types';
import { UniversalWorkerHost } from '../hosts/universal-worker-host.js';
import type { InitializerOptions } from './types.js';

interface WebWorkerInitializerOptions extends InitializerOptions {
    workerOptions?: UniversalWorkerOptions;
}

export async function webWorkerInitializer({
    communication,
    env: { env, endpointType },
    workerOptions,
}: WebWorkerInitializerOptions) {
    const isModule = workerOptions?.type === 'module';
    const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
    const url = `${communication.getPublicPath()}${env}.webworker.${isModule ? 'mjs' : 'js'}${location.search}`;
    const webWorker = new Worker(url, {
        name: instanceId,
        ...workerOptions,
    });

    const host = new UniversalWorkerHost(webWorker, instanceId);

    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    await communication.envReady(instanceId);
    return {
        id: instanceId,
    };
}
