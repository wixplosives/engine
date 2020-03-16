import { EnvironmentInitializer } from '../types';
import { SingleEndpointContextualEnvironment, Environment } from '../../entities';

export function contextualInitializer(): EnvironmentInitializer {
    return async (communication, environment) => {
        const runtimeEnvironmentName = communication.resolvedContexts[environment.env];

        const activeEnvironment = (environment as SingleEndpointContextualEnvironment<
            string,
            Environment[],
            EnvironmentInitializer
        >).environments.find(env => env.env === runtimeEnvironmentName)!;
        activeEnvironment.env = environment.env;
        return activeEnvironment.initializer(communication, activeEnvironment);
    };
}
