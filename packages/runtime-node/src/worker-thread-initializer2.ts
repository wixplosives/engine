import { InitializerOptions, UniversalWorkerHost } from '@wixc3/engine-core';
import { Worker } from '@wixc3/isomorphic-worker/worker';
import { createDisposables } from '@wixc3/patterns';

export interface WorkerThreadInitializer2 {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
}

export interface WorkerThreadInitializerOptions2 extends InitializerOptions {
    workerURL: URL;
}

export function workerThreadInitializer2({
    communication,
    env,
    workerURL,
}: WorkerThreadInitializerOptions2): WorkerThreadInitializer2 {
    const disposables = createDisposables();
    const instanceId = communication.getEnvironmentInstanceId(env.env, env.endpointType);
    const envIsReady = communication.envReady(instanceId);

    const nodeOnlyParams: object = {
        argv: process.argv.slice(2),
    };

    const initialize = async (): Promise<void> => {
        const worker = new Worker(workerURL, {
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
