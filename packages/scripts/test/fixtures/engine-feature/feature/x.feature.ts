import _3rdParty from '3rd-party/3rd-party.feature';
import { Feature, Slot } from '@wixc3/engine-core';

export default new Feature({
    id: 'XTestFeature',
    api: {
        mySlot: Slot.withType<{}>().defineEntity('main')
    },
    dependencies: [_3rdParty]
});
