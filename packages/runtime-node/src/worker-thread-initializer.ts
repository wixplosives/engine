import { Worker } from 'node:worker_threads';

import { COM, InitializerOptions } from '@wixc3/engine-core';

import { WorkerThreadHost } from './worker-thread-host';
import type { WorkerThreadCommand, WorkerThreadEnvironmentStartupOptions, WorkerThreadEvent } from './types';
import { getApplicationMetaData } from '@wixc3/engine-core-node';
import { deferred } from 'promise-assist';

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

    handleEvent(worker, (e) => {
        if (e.id === 'workerThreadInitFailedEvent') {
            workerInitFailed.reject(e.error);
        }
    });

    sendCommand(worker, {
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
            const workerEnvDisposed = deferred();

            handleEvent(worker, (e) => {
                if (e.id === 'workerThreadDisposedEvent') {
                    workerEnvDisposed.resolve();
                }
            });

            sendCommand(worker, {
                id: 'workerThreadDisposeCommand',
            });

            await workerEnvDisposed.promise;
            await worker.terminate();
        },
    };
}

function sendCommand(worker: Worker, command: WorkerThreadCommand) {
    worker.postMessage(command);
}

function handleEvent(worker: Worker, handler: (e: WorkerThreadEvent) => void) {
    worker.on('message', (e) => {
        const workerEvent = e as WorkerThreadEvent;
        if (workerEvent.id) {
            handler(workerEvent);
        }
    });
}
