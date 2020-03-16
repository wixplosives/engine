import { EnvironmentTypes } from '../types';
import { SingleEndpointContextualEnvironment, Environment, EnvironmentMode } from '../../entities';
import { Communication } from '../communication';

export function contextualInitializer<MODE extends EnvironmentMode, TYPE extends EnvironmentTypes>({
    environments,
    env
}: SingleEndpointContextualEnvironment<string, Environment<string, TYPE, MODE>[]>) {
    const getEnvironmentInitializerId = (runtimeEnviromnent: Environment) => {
        return `${env}/${runtimeEnviromnent.env}`;
    };

    return {
        initializer: async (communication: Communication) => {
            const runtimeEnvironmentName = communication.resolvedContexts[env];

            const activeEnvironment = environments.find(env => env.env === runtimeEnvironmentName)!;

            const environmentId = getEnvironmentInitializerId(activeEnvironment);

            activeEnvironment.env = env;

            const envInitializer = communication.getInitializer(environmentId);

            return communication.startEnvironment(activeEnvironment, envInitializer);
        },
        getEnvironmentInitializerId
    };
}
