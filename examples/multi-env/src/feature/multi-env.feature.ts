import { COM, Environment, Feature, Service, ContextualEnvironment, Config } from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single');
const workerEnv = new Environment('webworker1', 'webworker', 'single');
const nodeEnv = new Environment('node1', 'node', 'single');
export const processingEnv = new ContextualEnvironment('processing', 'single', [workerEnv, nodeEnv]);

export interface IEchoService {
    echo: (s: string) => string;
}

export interface INameProvider {
    name: () => string;
}
export default class ContextualEnvironmentTest extends Feature<'contextual-environment-test'> {
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
