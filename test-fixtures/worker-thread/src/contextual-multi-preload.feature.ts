import { Feature, Environment, COM, Service, ContextualEnvironment } from '@wixc3/engine-core';
import type { ContextualMultiPreloadWorkerEcho } from './contextual-multi-preload.worker.env';

export const contextualMultiServerEnv = new Environment('server', 'node', 'single');
export const workerEnv = new ContextualEnvironment('worker', 'multi', [
    new Environment('context1', 'workerthread', 'multi'),
    new Environment('context2', 'workerthread', 'multi'),
]);

export interface PreloadedGlobalThis {
    workerName: string;
}

export interface ContextualMultiPreloadWorkerService {
    echo: (values: string[]) => Promise<string[]>;
}

export default new Feature({
    id: 'contextual-multi-preload',
    api: {
        contextualMultiPreloadWorkersService: Service.withType<ContextualMultiPreloadWorkerService>()
            .defineEntity(contextualMultiServerEnv)
            .allowRemoteAccess(),
        contextualMultiPreloadWorkerEcho: Service.withType<ContextualMultiPreloadWorkerEcho>()
            .defineEntity(workerEnv)
            .allowRemoteAccess(),
    },
    dependencies: [COM.asDependency],
});

export const WorkerContext = workerEnv.useContext('context1');
