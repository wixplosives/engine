import { Feature } from '@wixc3/engine-core';

export default class NonContextual extends Feature<'nonContextual'> {
    id = 'nonContextual' as const;
    api = {};
    dependencies = [];
}
