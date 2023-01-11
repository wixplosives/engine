import type { InitializerOptions } from '@wixc3/engine-core';

export const LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID = '__engine-local-env__';

/**
 * when running the engine application, an active environment should be provided to this runtime, with the id {@link LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID}
 * when running engine application using [\@wixc3/engineer](../../engineer), it is done in the node environments manager
 */
export const localNodeEnvironmentInitializer = ({ communication: com, env }: InitializerOptions) => {
    const baseEnvHost = com.getEnvironmentHost(LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID)!;
    if (!baseEnvHost) {
        throw new Error(
            `Registration for ${LOCAL_ENVIRONMENT_INITIALIZER_ENV_ID} didn't happen. Cannot connect to remote environment`
        );
    }
    if (!com.getEnvironmentHost(env.env)) {
        com.registerEnv(env.env, baseEnvHost);
    }

    return {
        id: env.env,
    };
};
