import type { EnvironmentTypes } from '../com/types';
import { runtimeType } from '../entity-helpers';
import type { DisposableContext, EnvVisibility, MapBy } from '../types';

export type EnvironmentMode = 'single' | 'multi';
export type AnyEnvironment = Environment<string, EnvironmentTypes, EnvironmentMode, any>;

export type MultiEnvironment<TYPE extends EnvironmentTypes> = Environment<
    string,
    TYPE,
    'multi',
    MultiEnvironment<TYPE>[] | []
>;

// type EnvironmentDependencies<T>

// export type EnvNames<T> = T extends Array<infer U>
//     ? U extends Environment
//         ? U['dependencies'][number]['env'] | U['env']
//         : never
//     : never;

export class Environment<
    NAME extends string = string,
    TYPE extends EnvironmentTypes = EnvironmentTypes,
    MODE extends EnvironmentMode = EnvironmentMode,
    DEPS extends MultiEnvironment<TYPE>[] | [] = []
> {
    // __depNames: EnvNames<DEPS> = this.dependencies.map(({ env }) => env) as EnvNames<DEPS>;
    constructor(
        public readonly env: NAME,
        public readonly envType: TYPE,
        public readonly endpointType: MODE,
        public readonly dependencies: DEPS = [] as DEPS
    ) {}
}

export class EnvironmentContext {
    constructor(public env: string, public activeEnvironmentName: string) {}
}

export const Universal = new Environment('<Universal>', 'window', 'multi');
export const AllEnvironments: Environment = new Environment('<All>', 'window', 'multi');
export const NoEnvironments = new Environment('<None>', 'window', 'multi');

export const globallyProvidingEnvironments = new Set([Universal.env, AllEnvironments.env]);
export class SingleEndpointContextualEnvironment<NAME extends string, ENVS extends Environment[]> extends Environment<
    NAME,
    EnvironmentTypes,
    'single',
    []
> {
    constructor(env: NAME, public environments: ENVS) {
        super(env, 'context', 'single');

        if (environments.length === 0) {
            throw new Error(`Contextual Environment ${env} initiated without child environments`);
        }
    }

    public useContext(contextEnv: keyof MapBy<ENVS, 'env'>): EnvironmentContext {
        return new EnvironmentContext(this.env, contextEnv);
    }

    public withContext<I extends object>(): DisposableContext<I> {
        return {
            type: runtimeType<I & { dispose(): unknown }>(this.env + ' context'),
        };
    }

    public getEnvironmentById(id: keyof MapBy<ENVS, 'env'>) {
        return this.environments.find(({ env }) => env === id)!;
    }
}

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

export function isProvidedFrom(envVisibility: EnvVisibility, envSet: Set<string>) {
    if (Array.isArray(envVisibility)) {
        return envVisibility.some((e) => envSet.has(e.env));
    } else if (typeof envVisibility === 'string') {
        return envSet.has(envVisibility);
    } else {
        return envSet.has(envVisibility.env);
    }
}

export function isGloballyProvided(envVisibility: EnvVisibility) {
    return isProvidedFrom(envVisibility, globallyProvidingEnvironments);
}
