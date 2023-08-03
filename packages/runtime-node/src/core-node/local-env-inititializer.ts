import { InitializerOptions } from '@wixc3/engine-core';

import { ENGINE_ROOT_ENVIRONMENT_ID } from './constants';

/**
 * when running the engine application, an active environment should be provided to this runtime, with the id {@link ENGINE_ROOT_ENVIRONMENT_ID}
 * when running engine application using [\@wixc3/engineer](../../engineer), it is done in the node environments manager
 */
export const localNodeEnvironmentInitializer = ({ communication: com, env }: InitializerOptions) => {
    const rootEnvHost = com.getEnvironmentHost(ENGINE_ROOT_ENVIRONMENT_ID)!;
    if (!rootEnvHost) {
        throw new Error(
            `Registration for ${ENGINE_ROOT_ENVIRONMENT_ID} didn't happen. Cannot connect to remote environment`,
        );
    }
    if (!com.getEnvironmentHost(env.env)) {
        com.registerEnv(env.env, rootEnvHost);
    }

    return {
        id: env.env,
    };
};
