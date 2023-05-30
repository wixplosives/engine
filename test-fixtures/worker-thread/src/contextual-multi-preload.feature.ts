import { Feature, Environment, COM, Service, ContextualEnvironment } from '@wixc3/engine-core';
import type { ContextualMultiPreloadWorkerEcho } from './contextual-multi-preload.worker.env';

export const contextualMultiServerEnv = new Environment('server', 'node', 'single');
export const workerEnv = new ContextualEnvironment('worker', 'multi', [
    new Environment('context1', 'workerthread', 'multi'),
    new Environment('context2', 'workerthread', 'multi'),
]);

export interface ContextualMultiPreloadWorkerService {
    echo: (values: string[]) => Promise<string[]>;
}

export default class ContextualMultiPreloadFeature extends Feature<'contextual-multi-preload'> {
    id = 'contextual-multi-preload' as const;
    api = {
        contextualMultiPreloadWorkersService: Service.withType<ContextualMultiPreloadWorkerService>()
            .defineEntity(contextualMultiServerEnv)
            .allowRemoteAccess(),
        contextualMultiPreloadWorkerEcho: Service.withType<ContextualMultiPreloadWorkerEcho>()
            .defineEntity(workerEnv)
            .allowRemoteAccess(),
    };
    dependencies = [COM];
}

export const WorkerContext = workerEnv.useContext('context1');
