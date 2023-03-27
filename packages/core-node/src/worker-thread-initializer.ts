import { Worker } from 'node:worker_threads';

import type { InitializerOptions } from '@wixc3/engine-core';

import { WorkerThreadHost } from './worker-thread-host';
import { getApplicationMetaData } from './get-application-metadata';

export async function workerThreadInitializer({ communication, env: { env, endpointType } }: InitializerOptions) {
    const isSingleton = endpointType === 'single';
    const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);

    const { workerThreadEntryPath } = await getApplicationMetaData(communication);

    const worker = new Worker(workerThreadEntryPath, {
        workerData: {
            name: instanceId,
        },
    });

    const host = new WorkerThreadHost(worker);

    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);

    await communication.envReady(instanceId);

    return {
        id: instanceId,
        dispose: () => worker.terminate(),
    };
}
