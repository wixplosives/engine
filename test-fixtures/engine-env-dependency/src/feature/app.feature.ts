import { Environment, EngineFeature, Service, Slot } from '@wixc3/engine-core';

export const client = new Environment('client', 'window', 'multi');
export const page1 = new Environment('page1', 'window', 'single', [client]);

export default class EnvDependencies extends EngineFeature<'envDependencies'> {
    id = 'envDependencies' as const;
    api = {
        render: Service.withType<(content: string) => void>().defineEntity(client),
        wrapRender: Slot.withType<(content: string) => string>().defineEntity(client),
    };
    dependencies = [];
}
