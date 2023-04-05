import type { ContextualEnvironment, Environment, EnvironmentMode } from '../../entities';
import type { MapBy } from '../../types';
import type { InitializerOptions } from './types';

export type EnvironmentInitializer<T, OPTIONS extends InitializerOptions = InitializerOptions> = (
    options: OPTIONS
) => T;

export type EnvironmentInitializers<ENVS extends Environment[], EnvToken extends Promise<{ id: string }>> = {
    [K in keyof MapBy<ENVS, 'env'>]: EnvironmentInitializer<EnvToken>;
};

export interface ContextualEnvironmentInitializerOptions<
    ENVS extends Environment[],
    EnvToken extends Promise<{ id: string }>
> extends InitializerOptions {
    envInitializers: Partial<EnvironmentInitializers<ENVS, EnvToken>>;
    env: ContextualEnvironment<string, EnvironmentMode, ENVS>;
}
/**
 * TODO: better inference of the return type of the initialzier function
 */
export function initializeContextualEnv<ENVS extends Environment[], EnvToken extends Promise<{ id: string }>>({
    communication,
    env: { env, environments },
    envInitializers,
}: ContextualEnvironmentInitializerOptions<ENVS, EnvToken>) {
    const runtimeEnvironmentName = communication.resolvedContexts[env]!;

    const activeEnvironment = environments.find((contextualEnv) => contextualEnv.env === runtimeEnvironmentName);

    if (!activeEnvironment) {
        throw new Error(`${runtimeEnvironmentName} cannot be found in definition of ${env} environment`);
    }

    if (activeEnvironment.env in envInitializers) {
        const envInitializer = envInitializers[activeEnvironment.env as keyof typeof envInitializers];
        if (!envInitializer) {
            throw new Error(`environment initializer is not set for ${activeEnvironment.env}`);
        }
        return envInitializer({ communication, env: { ...activeEnvironment, env } });
    } else {
        throw new Error('error');
    }
}
