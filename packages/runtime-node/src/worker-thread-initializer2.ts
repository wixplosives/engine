import { IRunOptions, InitializerOptions, UniversalWorkerHost } from '@wixc3/engine-core';
import { Worker } from '@wixc3/isomorphic-worker/worker';
import { type UniversalWorkerOptions } from '@wixc3/isomorphic-worker/types';
import { createDisposables } from '@wixc3/patterns';
import { PerformanceMetrics } from './types';
import { getMetricsFromWorker } from './metrics-utils';

export interface WorkerThreadInitializer2 {
    id: string;
    dispose: () => Promise<void>;
    initialize: () => Promise<void>;
    getMetrics(): Promise<PerformanceMetrics>;
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
    const disposables = createDisposables('workerThreadInitializer');
    const instanceId = communication.getEnvironmentInstanceId(env.env, env.endpointType);
    const envIsReady = communication.envReady(instanceId);
    let worker: Worker;
    const initialize = async () => {
        const envRuntimeOptions = new Map(runtimeOptions?.entries());
        envRuntimeOptions.set('environment_id', instanceId);

        worker = new Worker(workerURL, {
            name: instanceId,
            workerData: { runtimeOptions: envRuntimeOptions },
            execArgv: process.execArgv,
        } as UniversalWorkerOptions);

        disposables.add('terminate worker', () => worker.terminate());

        const host = new UniversalWorkerHost(worker, instanceId);
        communication.registerEnv(instanceId, host);
        communication.registerMessageHandler(host);

        disposables.add('communication', () => {
            communication.clearEnvironment(instanceId);
            communication.removeMessageHandler(host);
        });

        await envIsReady;
    };

    return {
        id: instanceId,
        initialize,
        dispose: () => disposables.dispose(),
        getMetrics: () => getMetricsFromWorker(worker),
    };
}
