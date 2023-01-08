import { Environment, EngineFeature, Slot } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single');

export default class XTestFeature extends EngineFeature<'XTestFeature'> {
    id = 'XTestFeature' as const;
    api = {
        mySlot: Slot.withType<{}>().defineEntity(MAIN),
    };
    dependencies = [];
}
