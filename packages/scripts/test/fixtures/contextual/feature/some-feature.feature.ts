import {
    COM,
    Environment,
    Feature,
    NodeEnvironment,
    Service,
    SingleEndPointAsyncEnvironment,
    SingleEndpointContextualEnvironment
} from '@wixc3/engine-core';

export const mainEnv = new Environment('main');

const serverEnv = new NodeEnvironment('server');
const workerEnv = new SingleEndPointAsyncEnvironment('worker', 'worker', mainEnv);
export const contextualEnv = new SingleEndpointContextualEnvironment('contextual', [workerEnv, serverEnv]);

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
