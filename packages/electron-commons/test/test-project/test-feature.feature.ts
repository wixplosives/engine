import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export default class Run_errors_feature extends Feature<'run-errors-feature'> {
    id = 'run-errors-feature' as const;
    api = {
        errorType: new Config({
            type: 'exit',
            handleUncaught: false,
        }),
    };
    dependencies = [COM];
}
