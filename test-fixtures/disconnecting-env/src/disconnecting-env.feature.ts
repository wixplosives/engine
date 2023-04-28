import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export type ErrorTypeConfig = {
    throwError: 'exception' | 'exit' | 'promise-reject' | false;
    disposeTimeout: boolean;
    handleUncaught: boolean;
};

export default new Feature({
    id: 'disconnecting-env',
    api: {
        errorsConfig: Config.withType<ErrorTypeConfig>().defineEntity({
            throwError: 'exit',
            handleUncaught: false,
            disposeTimeout: false,
        }),
    },
    dependencies: [COM.asDependency],
});
