import { EngineFeature } from '@wixc3/engine-core';

export default class NonContextual extends EngineFeature<'nonContextual'> {
    id = 'nonContextual' as const;
    api = {};
    dependencies = [];
}
