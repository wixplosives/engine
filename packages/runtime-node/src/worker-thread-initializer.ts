import { Worker } from 'node:worker_threads';

import { COM, InitializerOptions } from '@wixc3/engine-core';
import { getApplicationMetaData } from '@wixc3/engine-core-node';
import { deferred } from 'promise-assist';

import { emitEvent, executeRemoteCall, onEvent } from './communication-helpers';
import type {
    WorkerThreadCommand,
    WorkerThreadDisposeCommand,
    WorkerThreadDisposedEvent,
    WorkerThreadEnvironmentStartupOptions,
    WorkerThreadEvent,
} from './types';
import { WorkerThreadHost } from './worker-thread-host';

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

    const runOptions: WorkerThreadEnvironmentStartupOptions = {
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

    const workerInitFailed = deferred<string>();

    onEvent<WorkerThreadEvent>(worker, (e) => {
        if (e.id === 'workerThreadInitFailedEvent') {
            workerInitFailed.reject(e.error);
        }
    });

    emitEvent<WorkerThreadCommand>(worker, {
        id: 'workerThreadStartupCommand',
        runOptions,
    });

    const initResult = await Promise.race([envReady, workerInitFailed.promise]);
    // envReady is Promise<void>, so if race result is string - it is initFailed promise
    if (typeof initResult === 'string') {
        throw new Error(initResult);
    }

    return {
        id: instanceId,
        dispose: async () => {
            await executeRemoteCall<WorkerThreadDisposeCommand, WorkerThreadDisposedEvent>(
                worker,
                {
                    id: 'workerThreadDisposeCommand',
                },
                'workerThreadDisposedEvent'
            );
            await worker.terminate();
        },
    };
}
