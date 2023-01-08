import { Environment, EngineFeature } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single');

export default class A extends EngineFeature<'a'> {
    id = 'a' as const;
    api = {};
}
