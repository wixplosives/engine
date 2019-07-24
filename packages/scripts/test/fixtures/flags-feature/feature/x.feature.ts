import { Environment, Feature } from '@wixc3/engine-core';

export const mainEnv = new Environment('main');

export default new Feature({
    id: 'XTestFeature',
    api: {},
    dependencies: [],
    flags: {
        SchemaReflection: {}
    }
});
