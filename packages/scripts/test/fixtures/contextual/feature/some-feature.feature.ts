import {
    COM,
    Environment,
    Feature,
    Service,
    SingleEndpointContextualEnvironment,
    windowInitializer,
    socketServerInitializer,
    workerInitializer,
    contextualInitializer
} from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single', windowInitializer());

const serverEnv = new Environment('server', 'node', 'single', socketServerInitializer());
const workerEnv = new Environment('worker', 'worker', 'single', workerInitializer());
export const contextualEnv = new SingleEndpointContextualEnvironment(
    'contextual',
    [workerEnv, serverEnv],
    contextualInitializer()
);

export interface IEchoContext {
    echoWord: () => string;
}

export default new Feature({
    id: 'multiEnv',
    api: {
        serverService: Service.withType<{ echo: () => string }>()
            .defineEntity(contextualEnv)
            .allowRemoteAccess()
    },
    dependencies: [COM],
    context: {
        echoContext: contextualEnv.withContext<IEchoContext>()
    }
});

export const Context = contextualEnv.useContext('worker');
