import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export type ErrorTypeConfig = {
    errorMode: 'exception' | 'exit' | 'promiseReject' | 'out-of-memory' | 'no-error' | 'dispose-timeout';
    handleUncaught: boolean;
};

export default new Feature({
    id: 'disconnecting-env',
    api: {
        errorType: Config.withType<ErrorTypeConfig>().defineEntity({
            errorMode: 'exit',
            handleUncaught: false,
        }),
    },
    dependencies: [COM.asDependency],
});
