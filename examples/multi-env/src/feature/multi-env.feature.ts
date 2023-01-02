import { COM, Environment, Feature, Service, SingleEndpointContextualEnvironment, Config } from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single');
const workerEnv = new Environment('webworker1', 'webworker', 'single');
const nodeEnv = new Environment('node1', 'node', 'single');
export const processingEnv = new SingleEndpointContextualEnvironment('processing', [workerEnv, nodeEnv]);

export interface IEchoService {
    echo: (s: string) => string;
}

export interface INameProvider {
    name: () => string;
}

export default new Feature({
    id: 'contextual-environment-test',
    dependencies: [COM.asDependency],
    api: {
        config: new Config<{ name: string }>({
            name: 'test',
        }),
        echoService: Service.withType<IEchoService>().defineEntity(processingEnv).allowRemoteAccess(),
    },
    context: {
        processingContext: processingEnv.withContext<INameProvider>(),
    },
});
