import { Worker } from '@wixc3/isomorphic-worker/worker';

import { UniversalWorkerHost } from '../hosts/universal-worker-host';
import type { InitializerOptions } from './types';

export async function webWorkerInitializer({
    communication,
    env: { env, endpointType },
    mjs,
}: InitializerOptions & { mjs?: true }) {
    const instanceId = communication.getEnvironmentInstanceId(env, endpointType);
    const url = `${communication.getPublicPath()}${env}.webworker.${mjs ? 'mjs' : 'js'}${location.search}`;
    const webWorker = new Worker(url, {
        name: instanceId,
        type: mjs ? 'module' : 'classic',
    });

    const host = new UniversalWorkerHost(webWorker, instanceId);

    communication.registerMessageHandler(host);
    communication.registerEnv(instanceId, host);
    await communication.envReady(instanceId);
    return {
        id: instanceId,
    };
}
