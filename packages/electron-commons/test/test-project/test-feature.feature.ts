import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'run-errors-feature',
    api: {
        errorType: new Config({
            type: 'exit',
            handleUncaught: false,
        }),
    },
    dependencies: [COM],
});
