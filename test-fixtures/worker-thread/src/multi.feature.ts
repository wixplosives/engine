import { Feature, Environment, COM, Service } from '@wixc3/engine-core';
import type { MultiWorkerEcho } from './multi.worker.env';

export const multiServerEnv = new Environment('server', 'node', 'single');
export const workerEnv = new Environment('worker', 'workerthread', 'multi');

export interface MultiWorkerService {
    initAndCallWorkersEcho: (values: string[]) => Promise<string[]>;
}

export default new Feature({
    id: 'multi',
    api: {
        multiWorkersService: Service.withType<MultiWorkerService>().defineEntity(multiServerEnv).allowRemoteAccess(),
        multiWorkerEcho: Service.withType<MultiWorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
    },
    dependencies: [COM.asDependency],
});
