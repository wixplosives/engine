import { SetMultiMap } from '@wixc3/patterns';
import type { RuntimeEngine } from '../runtime-engine';
import type { ENGINE, RUN_OPTIONS } from '../symbols';
import type {
    Context,
    DeepEnvironmentDeps,
    EntityRecord,
    EnvVisibility,
    FilterNotEnv,
    GetDependenciesOutput,
    GetOnlyLocalUniversalOutputs,
    GetRemoteOutputs,
    IRunOptions,
    MapRecordType,
    MapToProxyType,
    MapType,
    MapVisibleInputs,
    OmitCompositeEnvironment,
    PartialFeatureConfig,
    RegisteringFeature,
    Running,
} from '../types';
import type { AnyEnvironment, GloballyProvidingEnvironments } from './env';

/**
 @example
    import { EngineFeature, Config } from '@wixc3/engine-core';
    import { FeatureA } from './a.feature';
    import { FeatureB } from './b.feature';

    export class MyFeature extends EngineFeature<'my-feature'> {
        public id = 'my-feature' as const;
        public api = {
            config: Config.withType<{ id: string }>().defineEntity({ id: '' }),
        };
        public dependencies = [new FeatureA(), new FeatureB()];
        public context = {};
    }
 */
export class EngineFeature<T extends string> implements FeatureDescriptor {
    constructor() {
        validateRegistration(this);
    }
    public id: T = '' as T;
    public api: EntityRecord = {};
    public dependencies: FeatureDependencies = [];
    public context?: Record<string, Context<unknown>> = {};
    use = (c: PartialFeatureConfig<this['api']>) => provideConfig(this, c);
    setup = <E extends AnyEnvironment>(e: E, s: SetupHandler<this, E>) => setup(this, e, s);
    setupContext = <E extends AnyEnvironment, K extends keyof this['context'] & string>(
        e: E,
        k: K,
        s: ContextHandler<this, E, K>
    ) => setupContext(this, e, k, s);
}

export function createRuntimeInfo(): RuntimeInfo {
    return {
        setups: new SetMultiMap(),
        contexts: new Map(),
        envs: new Set(),
    };
}

export function provideConfig<T extends FeatureDescriptor>(
    feature: T,
    config: PartialFeatureConfig<T['api']>
): [T['id'], PartialFeatureConfig<T['api']>] {
    return [feature.id, config];
}

export function setup<T extends FeatureDescriptor, E extends AnyEnvironment>(
    feature: T,
    environment: E,
    setupHandler: SetupHandler<T, E>
) {
    const info = (feature.runtimeInfo ||= createRuntimeInfo());
    validateNoDuplicateEnvRegistration(environment, feature.id, info.envs);
    info.setups.add(environment.env, setupHandler);
}

export function setupContext<
    T extends FeatureDescriptor,
    E extends AnyEnvironment,
    K extends keyof T['context'] & string
>(
    feature: T,
    _environment: E, // TODO: add handlers in environments buckets with validation per environment?
    environmentContextKey: K,
    contextHandler: ContextHandler<T, E, K>
) {
    const info = (feature.runtimeInfo ||= createRuntimeInfo());
    validateNoDuplicateContextRegistration(environmentContextKey, feature.id, info.contexts);
    info.contexts.set(environmentContextKey, contextHandler);
}

export function validateNoDuplicateEnvRegistration(env: AnyEnvironment, featureId: string, registered: Set<string>) {
    const hasCollision = testEnvironmentCollision(env, registered);
    if (hasCollision.length) {
        const collisions = hasCollision.join(', ');
        throw new Error(
            `Feature can only have single setup for each environment. ${featureId} Feature already implements: ${collisions}`
        );
    }
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

export function validateNoDuplicateContextRegistration(
    environmentContext: string,
    featureId: string,
    contextHandlers: Map<string, ContextHandler<any, any, any>>
) {
    const registeredContext = contextHandlers.get(environmentContext);
    if (registeredContext) {
        throw new Error(
            `Feature can only have single setupContext for each context id. ${featureId} Feature already implements: ${String(
                environmentContext
            )}`
        );
    }
}

function validateRegistration(feature: FeatureDescriptor) {
    if (!feature.id) {
        throw new Error('Feature must have an id');
    }
}

export type RuntimeInfo = {
    setups: SetMultiMap<string, SetupHandler<any, any>>;
    contexts: Map<string, ContextHandler<any, any, any>>;
    envs: Set<string>;
};

export type FeatureDependencies = ReadonlyArray<FeatureDescriptor>;

export interface FeatureDescriptor {
    runtimeInfo?: RuntimeInfo;
    id: string;
    api: EntityRecord;
    dependencies: FeatureDependencies;
    context?: Record<string, Context<unknown>>;
}

export type RunningFeatures<T extends FeatureDependencies, E extends AnyEnvironment> = {
    [K in T[number]['id']]: Running<Extract<T[number], { id: K }>, E>;
};

export type SettingUpFeature<F extends FeatureDescriptor, E extends AnyEnvironment> = {
    id: F['id'];
    run: (fn: () => unknown) => void;
    onDispose: (fn: () => unknown) => void;
    [RUN_OPTIONS]: IRunOptions;
    [ENGINE]: RuntimeEngine<E>;
} & MapVisibleInputs<F['api'], GloballyProvidingEnvironments> &
    MapVisibleInputs<F['api'], E> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<F['api']>> &
    MapType<GetDependenciesOutput<F['api'], DeepEnvironmentDeps<E>>> &
    MapToProxyType<FilterNotEnv<GetRemoteOutputs<F['api']>, DeepEnvironmentDeps<E>, 'providedFrom'>>;

export type SetupHandler<F extends FeatureDescriptor, E extends AnyEnvironment> = (
    feature: SettingUpFeature<F, E>,
    runningFeatures: RunningFeatures<F['dependencies'], E>,
    context: MapRecordType<F['context']>
) => RegisteringFeature<F['api'], OmitCompositeEnvironment<E>>;

export type ContextHandler<F extends FeatureDescriptor, E extends AnyEnvironment, K extends keyof F['context']> = (
    runningFeatures: RunningFeatures<F['dependencies'], E>
) => F['context'][K] extends Context<infer U> ? U & {} : {};
