import { Feature, Environment, COM, Service } from '@wixc3/engine-core';
import type { MultiWorkerEcho } from './multi.worker.env.js';

export const multiServerEnv = new Environment('server', 'node', 'single');
export const workerEnv = new Environment('worker', 'workerthread', 'multi');

export interface MultiWorkerService {
    initAndCallWorkersEcho: (values: string[]) => Promise<string[]>;
}

export default class Multi extends Feature<'multi'> {
    id = 'multi' as const;
    api = {
        multiWorkersService: Service.withType<MultiWorkerService>().defineEntity(multiServerEnv).allowRemoteAccess(),
        multiWorkerEcho: Service.withType<MultiWorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
    };
    dependencies = [COM];
}
