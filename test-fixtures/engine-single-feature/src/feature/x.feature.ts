import { Config, Environment, Feature, Slot } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single');

export default new Feature({
    id: 'XTestFeature',
    api: {
        mySlot: Slot.withType<{}>().defineEntity('main'),
        config: new Config<{ value?: number }>({}),
    },
    dependencies: [],
});
