import _3rdParty, { MAIN } from '@fixture/3rd-party/dist/3rd-party.feature';
import { Config, Feature, Slot } from '@wixc3/engine-core';

export default new Feature({
    id: 'MultiFeature',
    dependencies: [_3rdParty],
    api: {
        mySlot: Slot.withType<string>().defineEntity(MAIN),
        myConfig: new Config<{ tags: string[] }>({ tags: [] }),
    },
});
