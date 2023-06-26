import { Worker } from '@wixc3/isomorphic-worker/worker';

import { InitializerOptions, UniversalWorkerHost } from '@wixc3/engine-core';

import { createDisposables } from '@wixc3/patterns';
import type { NodeEnvironmentStartupOptions } from './types';

export interface WorkerThreadInitializer2 {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
}

export type WorkerThreadInitializerOptions2 = InitializerOptions & {
    environmentStartupOptions?: Partial<NodeEnvironmentStartupOptions>;
};

export function workerThreadInitializer2({
    communication,
    env,
}: WorkerThreadInitializerOptions2): WorkerThreadInitializer2 {
    const disposables = createDisposables();
    const envName = env.env;
    const isSingleton = env.endpointType === 'single';
    const instanceId = isSingleton ? envName : communication.generateEnvInstanceID(envName);
    const envIsReady = communication.envReady(instanceId);
    const builtWorkerThreadEntryPath = `./${env.env}.workerthread.js`;

    const nodeOnlyParams: object = {
        argv: process.argv.slice(2),
    };

    const initialize = async (): Promise<void> => {
        const worker = new Worker(builtWorkerThreadEntryPath, {
            ...nodeOnlyParams,
            workerData: {
                name: instanceId,
            },
        });

        disposables.add(() => worker.terminate());

        const host = new UniversalWorkerHost(worker, instanceId);
        communication.registerEnv(instanceId, host);
        communication.registerMessageHandler(host);

        await envIsReady;
    };

    return {
        id: instanceId,
        initialize,
        dispose: disposables.dispose,
    };
}
