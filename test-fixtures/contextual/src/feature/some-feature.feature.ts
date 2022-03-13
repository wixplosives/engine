import { Environment, Feature, SingleEndpointContextualEnvironment } from '@wixc3/engine-core';
import { COM, Service } from '@wixc3/engine-com';

export const mainEnv = new Environment('main', 'window', 'single');

const workerEnv = new Environment('worker', 'worker', 'single');
const serverEnv = new Environment('server', 'node', 'single');
export const contextualEnv = new SingleEndpointContextualEnvironment('contextual', [workerEnv, serverEnv]);

export interface IEchoContext {
    echoWord: () => string;
}

export default new Feature({
    id: 'multiEnv',
    api: {
        serverService: Service.withType<{ echo: () => string }>().defineEntity(contextualEnv).allowRemoteAccess(),
    },
    dependencies: [COM],
    context: {
        echoContext: contextualEnv.withContext<IEchoContext>(),
    },
});

export const Context = contextualEnv.useContext('worker');
