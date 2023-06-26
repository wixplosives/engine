import { Worker } from '@wixc3/isomorphic-worker/worker';

import { UniversalWorkerHost } from '../hosts/universal-worker-host';
import type { InitializerOptions } from './types';

export async function webWorkerInitializer({ communication, env: { env, endpointType } }: InitializerOptions) {
    const isSingleton = endpointType === 'single';
    const instanceId = isSingleton ? env : communication.generateEnvInstanceID(env);

    const webWorker = new Worker(`${communication.getPublicPath()}${env}.webworker.mjs${location.search}`, {
        name: instanceId,
        type: 'module',
    });

    const host = new UniversalWorkerHost(webWorker, instanceId);

    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    await communication.envReady(instanceId);
    return {
        id: instanceId,
    };
}
