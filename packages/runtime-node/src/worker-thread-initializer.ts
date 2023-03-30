import { Worker } from 'node:worker_threads';

import { COM, InitializerOptions } from '@wixc3/engine-core';

import { WorkerThreadHost } from './worker-thread-host';
import type { IWorkerThreadEnvStartupMessage } from './types';
import { getApplicationMetaData } from './get-application-metadata';

export async function workerThreadInitializer({ communication, env }: InitializerOptions) {
    const isSingleton = env.endpointType === 'single';
    const instanceId = isSingleton ? env.env : communication.generateEnvInstanceID(env.env);
    const envReady = communication.envReady(instanceId);

    const { workerThreadEntryPath, requiredModules, basePath, config, featureName, features } =
        await getApplicationMetaData(communication);

    const worker = new Worker(workerThreadEntryPath, {
        workerData: {
            name: instanceId,
        },
    });

    const host = new WorkerThreadHost(worker);
    communication.registerEnv(instanceId, host);
    communication.registerMessageHandler(host);

    const runOptions = {
        requiredModules,
        basePath,
        environmentName: instanceId,
        /**
         * configuration contains data that can not be serialized to worker communication channel.
         * in the configuration of COM feature there is LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID
         * environment info that is needed when node env wants to start new node env.
         * this is not a case for workerthread, so ignoring that config here
         */
        config: config.filter(([featureId]) => featureId !== COM.id),
        featureName,
        features,
        parentEnvName: communication.getEnvironmentName(),
        env,
    };

    worker.postMessage({
        id: 'workerThreadStartupOptions',
        runOptions,
    } as IWorkerThreadEnvStartupMessage);

    await envReady;

    return {
        id: instanceId,
        dispose: async () => {
            await worker.terminate();
            communication.clearEnvironment(instanceId);
        },
    };
}
