import { Environment, Feature, Service, Slot } from '@wixc3/engine-core';
export const client = new Environment('client', 'window', 'single');
export const page1 = new Environment('page1', 'window', 'single', [client]);
export const server = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'envDependencies',
    dependencies: [],
    api: {
        render: Service.withType<(content: string) => void>().defineEntity(client),
        wrapRender: Slot.withType<(content: string) => string>().defineEntity(client),
    },
});
