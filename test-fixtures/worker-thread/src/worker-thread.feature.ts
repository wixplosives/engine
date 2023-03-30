import { Feature, Environment, COM, Service, Config } from '@wixc3/engine-core';
import type { WorkerEcho } from './worker-thread.worker.env';

export const serverEnv = new Environment('server', 'node', 'single');

export const workerEnv = new Environment('worker', 'workerthread', 'single');

export default new Feature({
    id: 'worker-thread',
    api: {
        workerEcho: Service.withType<WorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
        workerResponseConfig: Config.withType<{ response: string }>().defineEntity({
            response: 'pong',
        }),
    },
    dependencies: [COM.asDependency],
});
