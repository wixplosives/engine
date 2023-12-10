import { COM, UniversalWorkerHost, type InitializerOptions } from '@wixc3/engine-core';
import type { UniversalWorkerOptions } from '@wixc3/isomorphic-worker/types';
import { Worker } from '@wixc3/isomorphic-worker/worker';
import { createDisposables } from '@wixc3/patterns';
import { createMetadataProvider } from './core-node/create-application-metadata-provider.js';
import type { WorkerThreadCommand, WorkerThreadEnvironmentStartupOptions } from './types.js';

export interface WorkerThreadInitializer {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
}

export type WorkerThreadInitializerOptions = InitializerOptions & {
    environmentStartupOptions?: {
        environmentContextName: string | undefined;
    };
};

const workerThreadEntryPath = require.resolve('./worker-thread-entry');

export function workerThreadInitializer({
    communication,
    env,
    environmentStartupOptions,
}: WorkerThreadInitializerOptions): WorkerThreadInitializer {
    const disposables = createDisposables('workerThreadInitializer');

    const instanceId = communication.getEnvironmentInstanceId(env.env, env.endpointType);

    const envIsReady = communication.envReady(instanceId);

    const metadataProvider = createMetadataProvider(communication);
    disposables.add({
        name: 'worker thread metadataProvider',
        timeout: 5_000,
        dispose: () => metadataProvider.dispose(),
    });

    const initialize = async (): Promise<void> => {
        const { requiredModules, basePath, config, featureName, features, runtimeOptions } =
            await metadataProvider.getMetadata();

        const worker = new Worker(workerThreadEntryPath, {
            workerData: {
                name: instanceId,
            },
            execArgv: [...process.execArgv],
        } as UniversalWorkerOptions);

        disposables.add({
            name: `worker thread ${instanceId} terminate`,
            timeout: 5_000,
            dispose: () => worker.terminate(),
        });

        const host = new UniversalWorkerHost(worker, instanceId);
        communication.registerEnv(instanceId, host);
        communication.registerMessageHandler(host);

        disposables.add(`worker thread ${instanceId} communication cleanup`, () => {
            communication.clearEnvironment(instanceId);
            communication.removeMessageHandler(host);
        });

        const runOptions: WorkerThreadEnvironmentStartupOptions = {
            environmentContextName: environmentStartupOptions?.environmentContextName,
            runtimeOptions,
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
            id: 'workerThreadStartupCommand',
            runOptions,
        } as WorkerThreadCommand);

        await envIsReady;
    };

    return {
        id: instanceId,
        initialize,
        dispose: disposables.dispose,
    };
}
