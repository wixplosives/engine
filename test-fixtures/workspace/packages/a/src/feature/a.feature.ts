import { Environment, Feature } from '@wixc3/engine-core';

export const MAIN = new Environment('main', 'window', 'single');

export default class A extends Feature<'a'> {
    id = 'a' as const;
    api = {};
}
