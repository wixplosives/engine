import { EnvironmentTypes } from '../com/types';
import { runtimeType } from '../entity-helpers';
import { DisposableContext, EnvVisibility, MapBy } from '../types';
import { AsyncSingleEndpointEnvironment } from './async-env';

export interface AllEnvironments {
    env: string;
    endpointType: EndpointType;
}

export type EndpointType = 'single' | 'multi';

export class Environment<ID extends string, EType extends EndpointType = 'single'> {
    constructor(
        public env: ID,
        public endpointType: EType = 'single' as EType,
        public envType: EnvironmentTypes = 'window'
    ) {}
}

export class NodeEnvironment<ID extends string> extends Environment<ID, 'single'> {
    constructor(env: ID) {
        super(env, 'single', 'node');
    }

    public getLocalTopology(port: number) {
        return {
            [this.env]: `http://localhost:${port}/_ws`
        };
    }
}

export class EnvironmentContext {
    constructor(public env: string, public activeEnvironmentName: string, public runtimeEnvType: EnvironmentTypes) {}
}

export class SingleEndpointContextualEnvironment<
    ID extends string,
    T extends AsyncSingleEndpointEnvironment[]
> extends Environment<ID, 'single'> {
    public envType = 'context' as const;
    constructor(env: ID, public environments: T) {
        super(env, 'single', 'context');

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

export const Universal = new Environment('<Universal>', 'multi');
export const AllEnvironments: AllEnvironments = new Environment('<All>', 'multi');
export const NoEnvironments = new Environment('<None>', 'multi');

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
