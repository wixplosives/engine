import { COM, Environment, Feature, Slot } from '@wixc3/engine-core';

export const client = new Environment('main', 'window', 'single');
export const iframe = new Environment('iframe', 'iframe', 'single');

export default new Feature({
    id: 'baseApp',
    api: {
        clientSlot: Slot.withType<string>().defineEntity(client),
        iframeSlot: Slot.withType<string>().defineEntity(iframe),
    },
    dependencies: [COM],
});
