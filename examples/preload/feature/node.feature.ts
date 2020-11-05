if (globalThis.envMessages) {
    globalThis.envMessages.push('feature');
}

import { Feature, COM, Environment, Service } from '@wixc3/engine-core';

export const nodeEnv = new Environment('node1', 'node', 'single');
export const mainEnv = new Environment('main', 'window', 'single');
export const workerEnv = new Environment('worker1', 'worker', 'single');

export default new Feature({
    id: 'nodefeature',
    dependencies: [COM],
    api: {
        nodeEnvMessages: Service.withType<{ getNodeEnvMessages: () => Array<string> }>()
            .defineEntity(nodeEnv)
            .allowRemoteAccess(),
        workerEnvMessages: Service.withType<{ getWorkerEnvMessages: () => Array<string> }>()
            .defineEntity(workerEnv)
            .allowRemoteAccess(),
    },
});
