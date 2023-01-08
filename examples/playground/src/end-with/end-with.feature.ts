import { EngineFeature } from '@wixc3/engine-core';
import Preview from '../preview/compiler.feature';

export default class EndWith extends EngineFeature<'endWith'> {
    id = 'endWith' as const;
    api = {};
    dependencies = [Preview];
}
