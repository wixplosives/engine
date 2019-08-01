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
const workerEnv = new SingleEndPointAsyncEnvironment('worker', 'worker', mainEnv);
const liveServerEnv = new NodeEnvironment('live-server');
export const processingEnv = new SingleEndpointContextualEnvironment('processing', [workerEnv, liveServerEnv]);

export interface IEchoService {
    echo: (s: string) => string;
}

export interface INameProvider {
    name: () => string;
}

export default new Feature({
    id: 'contextual-environment-test',
    dependencies: [COM],
    api: {
        echoService: Service.withType<IEchoService>()
            .defineEntity(processingEnv)
            .allowRemoteAccess()
    },
    context: {
        processingContext: processingEnv.withContext<INameProvider>()
    }
});
