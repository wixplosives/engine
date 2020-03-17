import { EnvironmentTypes, EnvironmentInitializer } from '../types';
import { SingleEndpointContextualEnvironment, Environment, EnvironmentMode } from '../../entities';
import { Communication } from '../communication';

export function initializeContextualEnv<MODE extends EnvironmentMode, TYPE extends EnvironmentTypes>({
    env,
    environments
}: SingleEndpointContextualEnvironment<string, Environment<string, TYPE, MODE>[]>) {
    const envInitializers: { [envName: string]: EnvironmentInitializer<any> } = {};

    return {
        initializer: (communication: Communication) => {
            const runtimeEnvironmentName = communication.resolvedContexts[env];

            const activeEnvironment = environments.find(contextualEnv => contextualEnv.env === runtimeEnvironmentName);

            if (!activeEnvironment) {
                throw new Error(`${runtimeEnvironmentName} cannot be found in definition of ${env} environment`);
            }
            const envInitializer = envInitializers[activeEnvironment.env];

            if (!envInitializer) {
                throw new Error(`environment initializer is not set for ${activeEnvironment.env}`);
            }

            return communication.startEnvironment({ ...activeEnvironment, env }, envInitializer);
        },
        setEnvironmentInitializer: ({ env }: Environment, initializer: EnvironmentInitializer<any>) => {
            if (envInitializers[env]) {
                throw new Error(`cannot set initializer for ${env} because it was already setup`);
            }

            envInitializers[env] = initializer;
        }
    };
}
