import { Config, Feature, Environment, COM } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export type ErrorTypeConfig = {
    throwError: 'exception' | 'exit' | 'promise-reject' | false;
    handleUncaught: boolean;
};

export class DisconnectingEnv extends Feature<'disconnecting-env'> {
    id = 'disconnecting-env' as const;
    api = {
        errorsConfig: Config.withType<ErrorTypeConfig>().defineEntity({
            throwError: 'exception',
            handleUncaught: false,
        }),
    };
    dependencies = [COM];
}
