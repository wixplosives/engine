import { Environment, Feature, Value, Slot } from '@wixc3/engine-core';

export const client = new Environment('client', 'window', 'multi');
export const page1 = new Environment('page1', 'window', 'single', [client]);

export default new Feature({
    id: 'envDependencies',
    dependencies: [],
    api: {
        render: Value.withType<(content: string) => void>().defineEntity(client),
        wrapRender: Slot.withType<(content: string) => string>().defineEntity(client),
    },
});
