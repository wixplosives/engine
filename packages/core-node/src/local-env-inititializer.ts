import { BaseHost, EnvironmentInitializer } from '@wixc3/engine-core';

export const localNodeEnvironmentInitializer: EnvironmentInitializer<{ id: string }> = async (com, env) => {
    // an environment is always set up with a host, this will always exist
    const baseEnvHost = com.getEnvironmentHost(com.getEnvironmentId())!;

    if (baseEnvHost instanceof BaseHost) {
        if (!baseEnvHost.parent) {
            throw new Error(
                'Environment was set up with a host without a parent. This initializer is not applicable for this host'
            );
        }
        com.registerEnv(env.env, baseEnvHost.parent);
    }

    return Promise.resolve({
        id: env.env,
    });
};
