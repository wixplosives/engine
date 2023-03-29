import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export type ErrorTypeConfig = {
    type: 'exception' | 'exit' | 'promiseReject' | 'out-of-memory' | 'no-error';
    handleUncaught: boolean;
};

export default new Feature({
    id: 'disconnecting-env',
    api: {
        errorType: Config.withType<ErrorTypeConfig>().defineEntity({
            type: 'exit',
            handleUncaught: false,
        }),
    },
    dependencies: [COM.asDependency],
});
