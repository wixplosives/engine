import { Worker } from 'node:worker_threads';

import { COM, InitializerOptions } from '@wixc3/engine-core';
import { createMetadataProvider } from '@wixc3/engine-core-node';

import type {
    NodeEnvironmentStartupOptions,
    WorkerThreadCommand,
    WorkerThreadDisposedEvent,
    WorkerThreadEnvironmentStartupOptions,
} from './types';
import { WorkerThreadHost } from './worker-thread-host';
import { createDisposables } from '@wixc3/patterns';

export interface WorkerThreadInitializer {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
}

export type WorkerThreadInitializerOptions = InitializerOptions & {
    environmentStartupOptions?: Partial<NodeEnvironmentStartupOptions>;
};

export function workerThreadInitializer({
    communication,
    env,
    environmentStartupOptions,
}: WorkerThreadInitializerOptions): WorkerThreadInitializer {
    const disposables = createDisposables();

    const isSingleton = env.endpointType === 'single';
    const instanceId = isSingleton ? env.env : communication.generateEnvInstanceID(env.env);
    const envIsReady = communication.envReady(instanceId);

    const metadataProvider = createMetadataProvider(communication);
    disposables.add(() => metadataProvider.dispose());

    const initialize = async (): Promise<void> => {
        const { workerThreadEntryPath, requiredModules, basePath, config, featureName, features, runtimeOptions } =
            await metadataProvider.getMetadata();
        const worker = new Worker(workerThreadEntryPath, {
            workerData: {
                name: instanceId,
            },
        });

        disposables.add(
            () =>
                new Promise<void>((resolve) => {
                    const handleWorkerDisposed = (e: unknown) => {
                        if ((e as WorkerThreadDisposedEvent).id === 'workerThreadDisposedEvent') {
                            worker.off('message', handleWorkerDisposed);
                            resolve();
                        }
                    };

                    worker.on('message', handleWorkerDisposed);

                    worker.postMessage({
                        id: 'workerThreadDisposeCommand',
                    } as WorkerThreadCommand);
                })
        );

        const host = new WorkerThreadHost(worker);
        communication.registerEnv(instanceId, host);
        communication.registerMessageHandler(host);

        const runOptions: WorkerThreadEnvironmentStartupOptions = {
            ...environmentStartupOptions,
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
