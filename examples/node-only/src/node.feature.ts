import { Environment, Feature } from '@wixc3/engine-core';
export const NodeEnv = new Environment('nodeEnv', 'node', 'single');

export default class Node extends Feature<'node'> {
    id = 'node' as const;
    api = {};
}
