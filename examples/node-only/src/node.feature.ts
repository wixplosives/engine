import { Environment, Feature } from '@wixc3/engine-core';

export const NodeEnv = new Environment('nodeEnv', 'node', 'single');

export default new Feature({
    id: 'node',
    api: {},
});
