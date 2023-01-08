import _3rdParty, { MAIN } from '@fixture/3rd-party/dist/3rd-party.feature';
import { Config, EngineFeature, Slot } from '@wixc3/engine-core';

export default class MultiFeature extends EngineFeature<'MultiFeature'> {
    id = 'MultiFeature' as const;
    api = {
        mySlot: Slot.withType<string>().defineEntity(MAIN),
        myConfig: new Config<{
            tags: string[];
        }>({ tags: [] }),
    };
    dependencies = [_3rdParty];
}
