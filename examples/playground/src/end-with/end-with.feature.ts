import { Feature } from '@wixc3/engine-core';
import Preview from '../preview/compiler.feature';

export default class EndWith extends Feature<'endWith'> {
    id = 'endWith' as const;
    api = {};
    dependencies = [Preview];
}
