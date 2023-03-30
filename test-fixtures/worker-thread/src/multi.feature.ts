import { Feature, Environment, COM, Service, Config } from '@wixc3/engine-core';
import type { MultiWorkerEcho } from './multi.worker.env';

export const serverEnv = new Environment('server', 'node', 'single');
export const workerEnv = new Environment('worker', 'workerthread', 'multi');

export default new Feature({
    id: 'multi',
    api: {
        multiWorkerEcho: Service.withType<MultiWorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
        workerResponseConfig: Config.withType<{ response: string }>().defineEntity({
            response: 'pong',
        }),
    },
    dependencies: [COM.asDependency],
});
