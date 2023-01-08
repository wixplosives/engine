import {
    COM,
    Environment,
    EngineFeature,
    Service,
    SingleEndpointContextualEnvironment,
    Config,
} from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
const workerEnv = new Environment('worker1', 'worker', 'single');
const nodeEnv = new Environment('node1', 'node', 'single');
export const processingEnv = new SingleEndpointContextualEnvironment('processing', [workerEnv, nodeEnv]);

export interface IEchoService {
    echo: (s: string) => string;
}

export interface INameProvider {
    name: () => string;
}
export default class Contextual_environment_test extends EngineFeature<'contextual-environment-test'> {
    id = 'contextual-environment-test' as const;
    api = {
        config: new Config<{
            name: string;
        }>({
            name: 'test',
        }),
        echoService: Service.withType<IEchoService>().defineEntity(processingEnv).allowRemoteAccess(),
    };
    dependencies = [COM];
    context = {
        processingContext: processingEnv.withContext<INameProvider>(),
    };
}
