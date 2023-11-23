import { Worker } from '@wixc3/isomorphic-worker/worker';
import type { UniversalWorkerOptions } from '@wixc3/isomorphic-worker/types';
import { UniversalWorkerHost } from '../hosts/universal-worker-host.js';
import type { InitializerOptions } from './types.js';

export interface WebWorkerInitializerOptions extends InitializerOptions {
    workerOptions?: UniversalWorkerOptions;
    workerExtension?: string;
}

export async function webWorkerInitializer({
    communication,
    env: { env, endpointType },
    workerOptions = {},
    workerExtension = '.js',
}: WebWorkerInitializerOptions) {
    const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
    const url = `${communication.getPublicPath()}${env}.webworker${workerExtension}${location.search}`;
    const webWorker = new Worker(url, {
        type: (globalThis as any).DEFAULT_WORKER_TYPE || 'classic',
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
