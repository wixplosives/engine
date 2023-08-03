import { Feature, Environment, COM, Service } from '@wixc3/engine-core';
import type { WorkerEcho } from './worker-thread.worker.env';

export const serverEnv = new Environment('server', 'node', 'single');

export const workerEnv = new Environment('worker', 'workerthread', 'single');

export interface WorkerService {
    initAndCallWorkerEcho: (value: string) => Promise<string>;
}

export default class WorkerThread extends Feature<'worker-thread'> {
    id = 'worker-thread' as const;
    api = {
        workerService: Service.withType<WorkerService>().defineEntity(serverEnv).allowRemoteAccess(),
        workerEcho: Service.withType<WorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
    };
    dependencies = [COM];
}
