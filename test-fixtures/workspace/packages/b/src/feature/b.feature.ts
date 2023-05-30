import { Feature } from '@wixc3/engine-core';

export default class B extends Feature<'b'> {
    id = 'b' as const;
    api = {};
}
