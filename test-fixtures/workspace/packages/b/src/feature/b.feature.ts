import { EngineFeature } from '@wixc3/engine-core';

export default class B extends EngineFeature<'b'> {
    id = 'b' as const;
    api = {};
}
