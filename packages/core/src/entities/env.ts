import { EnvironmentTypes } from '../com/types';
import { runtimeType } from '../entity-helpers';
import { DisposableContext, EnvVisibility, MapBy } from '../types';

export type EndpointType = 'single' | 'multi';

export class Environment<ID extends string = string, EType extends EndpointType = EndpointType> {
    constructor(public env: ID, public envType: EnvironmentTypes, public endpointType: EType) {}
}

export class EnvironmentContext {
    constructor(public env: string, public activeEnvironmentName: string, public runtimeEnvType: EnvironmentTypes) {}
}

export class SingleEndpointContextualEnvironment<ID extends string, T extends Environment[]> extends Environment<
    ID,
    'single'
> {
    public envType = 'context' as const;
    constructor(env: ID, public environments: T) {
        super(env, 'context', 'single');

        if (environments.length === 0) {
            throw new Error(`Contextual Environment ${env} initiated without child environments`);
        }
    }

    public useContext(contextEnv: keyof MapBy<T, 'env'>): EnvironmentContext {
        return new EnvironmentContext(
            this.env,
            contextEnv,
            this.environments.find(({ env }) => env === contextEnv)!.envType
        );
    }

    public withContext<I>(): DisposableContext<I> {
        return {
            type: runtimeType<I & { dispose(): unknown }>(this.env + ' context')
        };
    }
}

export const Universal = new Environment('<Universal>', 'window', 'multi');
export const AllEnvironments: Environment = new Environment('<All>', 'window', 'multi');
export const NoEnvironments = new Environment('<None>', 'window', 'multi');

export function normEnvVisibility(envVisibility: EnvVisibility): Set<string> {
    const envSet = new Set<string>();
    if (Array.isArray(envVisibility)) {
        for (const e of envVisibility) {
            envSet.add(e.env);
        }
    } else if (typeof envVisibility === 'string') {
        envSet.add(envVisibility);
    } else {
        envSet.add(envVisibility.env);
    }
    return envSet;
}

export function testEnvironmentCollision(envVisibility: EnvVisibility, envSet: Set<string>): string[] {
    const containsEnv = new Set<string>();
    const test = (env: string) => {
        envSet.has(env) ? containsEnv.add(env) : envSet.add(env);
    };
    if (Array.isArray(envVisibility)) {
        for (const e of envVisibility) {
            test(e.env);
        }
    } else if (typeof envVisibility === 'string') {
        test(envVisibility);
    } else {
        test(envVisibility.env);
    }
    return [...containsEnv];
}
