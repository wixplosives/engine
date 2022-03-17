import { Config, Feature, Environment } from '@wixc3/engine-core';
import { COM } from '@wixc3/engine-com';

export const serverEnv = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'run-errors-feature',
    api: {
        errorType: new Config({
            type: 'exit',
            handleUncaught: false,
        }),
    },
    dependencies: [COM.asEntity],
});
