import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export type ErrorsConfig = {
    throwError: 'exception' | 'exit' | 'promise-reject' | false;
    handleUncaught: boolean;
};

export default new Feature({
    id: 'disconnecting-env',
    api: {
        errorsConfig: Config.withType<ErrorsConfig>().defineEntity({
            throwError: 'exit',
            handleUncaught: false,
        }),
    },
    dependencies: [COM.asDependency],
});
