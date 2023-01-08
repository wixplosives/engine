import { Environment, EngineFeature } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single');

export default class TestFeature extends EngineFeature<'TestFeature'> {
    id = 'TestFeature' as const;
    api = {};
}
