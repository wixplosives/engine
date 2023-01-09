import { Feature, COM, Environment, Service } from '@wixc3/engine-core';

globalThis.envMessages = [...(globalThis.envMessages ?? []), 'feature'];

export const nodeEnv = new Environment('node1', 'node', 'single');
export const mainEnv = new Environment('main', 'window', 'single');
export const workerEnv = new Environment('worker1', 'worker', 'single');

export default class Allfeature extends Feature<'allfeature'> {
    id = 'allfeature' as const;
    api = {
        nodeEnvMessages: Service.withType<{
            getNodeEnvMessages: () => Array<string>;
            getNodeRuntimeOptions: () => Record<string, string | boolean>;
        }>()
            .defineEntity(nodeEnv)
            .allowRemoteAccess(),
        workerEnvMessages: Service.withType<{
            getWorkerEnvMessages: () => Array<string>;
        }>()
            .defineEntity(workerEnv)
            .allowRemoteAccess(),
    };
    dependencies = [COM];
}
