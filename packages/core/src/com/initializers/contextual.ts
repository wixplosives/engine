import type { EnvironmentInitializer } from '../types';
import type { SingleEndpointContextualEnvironment, Environment } from '../../entities';
import type { Communication } from '../communication';
import type { MapBy } from '../../types';

export type EnvironmentInitializers<ENVS extends Environment[]> = {
    [K in keyof MapBy<ENVS, 'env'>]: EnvironmentInitializer<any>;
};

/**
 * TODO: better inference of the return type of the initialzier function
 */
export function initializeContextualEnv<ENVS extends Environment[]>(
    { env, environments }: SingleEndpointContextualEnvironment<string, ENVS>,
    envInitializers: EnvironmentInitializers<ENVS>
) {
    return (communication: Communication) => {
        const runtimeEnvironmentName = communication.resolvedContexts[env];

        const activeEnvironment = environments.find((contextualEnv) => contextualEnv.env === runtimeEnvironmentName);

        if (!activeEnvironment) {
            throw new Error(`${runtimeEnvironmentName} cannot be found in definition of ${env} environment`);
        }

        if (activeEnvironment.env in envInitializers) {
            const key: keyof typeof envInitializers = activeEnvironment.env;
            const envInitializer = envInitializers[key];
            if (!envInitializer) {
                throw new Error(`environment initializer is not set for ${activeEnvironment.env}`);
            }

            return communication.startEnvironment({ ...activeEnvironment, env }, envInitializer);
        } else {
            throw new Error('error');
        }
    };
}
