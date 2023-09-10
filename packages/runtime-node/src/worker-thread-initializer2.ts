import { IRunOptions, InitializerOptions, UniversalWorkerHost } from '@wixc3/engine-core';
import { Worker } from '@wixc3/isomorphic-worker/worker';
import { createDisposables } from '@wixc3/patterns';

export interface WorkerThreadInitializer2 {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
}

export interface WorkerThreadInitializerOptions2 extends InitializerOptions {
    workerURL: URL;
    runtimeOptions?: IRunOptions;
}

export function workerThreadInitializer2({
    communication,
    env,
    workerURL,
    runtimeOptions,
}: WorkerThreadInitializerOptions2): WorkerThreadInitializer2 {
    const disposables = createDisposables();
    const instanceId = communication.getEnvironmentInstanceId(env.env, env.endpointType);
    const envIsReady = communication.envReady(instanceId);

    const initialize = async (): Promise<void> => {
        const envRuntimeOptions = new Map(runtimeOptions?.entries());
        envRuntimeOptions.set('environment_id', instanceId);

        const worker = new Worker(workerURL, {
            name: instanceId,
            workerData: { runtimeOptions: envRuntimeOptions },
        });
        disposables.add(() => worker.terminate());

        const host = new UniversalWorkerHost(worker, instanceId);
        communication.registerEnv(instanceId, host);
        communication.registerMessageHandler(host);

        disposables.add(() => {
            communication.clearEnvironment(instanceId);
            communication.removeMessageHandler(host);
        });

        await envIsReady;
    };

    return {
        id: instanceId,
        initialize,
        dispose: disposables.dispose,
    };
}
