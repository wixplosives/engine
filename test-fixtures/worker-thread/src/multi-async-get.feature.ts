import { Feature, Environment, COM, Service, Config } from '@wixc3/engine-core';
import type { MultiWorkerEcho } from './multi-async-get.worker.env';

export const serverEnv = new Environment('server', 'node', 'single');
export const workerEnv = new Environment('worker', 'workerthread', 'multi');

export default new Feature({
    id: 'multi-async-get',
    api: {
        multiWorkerEcho: Service.withType<MultiWorkerEcho>().defineEntity(workerEnv).allowRemoteAccess(),
        workerResponseConfig: Config.withType<{ response: string }>().defineEntity({
            response: 'pong',
        }),
    },
    dependencies: [COM.asDependency],
});
