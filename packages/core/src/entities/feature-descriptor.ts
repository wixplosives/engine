import { SetMultiMap } from '@wixc3/patterns';
import type { RuntimeEngine } from '../runtime-engine';
import { ENGINE, RUN_OPTIONS } from '../symbols';
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
    RunningInstance,
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
export class Feature<T extends string> {
    public id: T = '' as T;
    public api: EntityRecord = {};
    public dependencies: FeatureDependencies = [];
    public context: Record<string, Context<unknown>> = {};
    static runtimeInfo: undefined | RuntimeInfo = undefined; // each class should have its own runtime info
    static isEngineFeature = true;
    constructor() {
        return ((this.constructor as any).instance ||= this);
    }
    static get id(): string {
        return validateRegistration(new this());
    }
    static dependencies<T extends FeatureClass>(): InstanceType<T>['dependencies'] {
        return new this().dependencies;
    }
    static api<T extends FeatureClass>(this: T): InstanceType<T>['api'] {
        return new this().api;
    }
    static context<T extends FeatureClass>(this: T): InstanceType<T>['context'] {
        return new this().context;
    }
    static use<T extends FeatureClass>(this: T, c: PartialFeatureConfig<InstanceType<T>['api']>) {
        return provideConfig(this, c);
    }
    static setup<T extends FeatureClass, E extends AnyEnvironment>(this: T, e: E, s: SetupHandler<T, E>): T {
        return setup(this, e, s);
    }
    static setupContext<
        T extends FeatureClass,
        E extends AnyEnvironment,
        K extends keyof InstanceType<T>['context'] & string
    >(this: T, e: E, k: K, s: ContextHandler<T, E, K>): T {
        return setupContext(this, e, k, s);
    }
}

export function createRuntimeInfo(): RuntimeInfo {
    return {
        setups: new SetMultiMap(),
        contexts: new Map(),
        envs: new Set(),
    };
}

export function provideConfig<T extends FeatureClass>(
    feature: T,
    config: PartialFeatureConfig<InstanceType<T>['api']>
): [InstanceType<T>['id'], PartialFeatureConfig<InstanceType<T>['api']>] {
    return [feature.id, config];
}

export const setup = <T extends FeatureClass, E extends AnyEnvironment>(
    feature: T,
    environment: E,
    setupHandler: SetupHandler<T, E>
): T => {
    const info = (feature.runtimeInfo ||= createRuntimeInfo());
    validateNoDuplicateEnvRegistration(environment, feature.id, info.envs);
    info.setups.add(environment.env, setupHandler);
    return feature;
};

export function setupContext<
    T extends FeatureClass,
    E extends AnyEnvironment,
    K extends keyof InstanceType<T>['context'] & string
>(
    feature: T,
    _environment: E, // TODO: add handlers in environments buckets with validation per environment?
    environmentContextKey: K,
    contextHandler: ContextHandler<T, E, K>
): T {
    const info = (feature.runtimeInfo ||= createRuntimeInfo());
    validateNoDuplicateContextRegistration(environmentContextKey, feature.id, info.contexts);
    info.contexts.set(environmentContextKey, contextHandler);
    return feature;
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

function validateRegistration(feature: { id: string }) {
    if (!feature.id) {
        throw new Error('Feature must have an id');
    }
    return feature.id;
}

type RuntimeInfo = {
    setups: SetMultiMap<string, SetupHandler<any, any>>;
    contexts: Map<string, ContextHandler<any, any, any>>;
    envs: Set<string>;
};

export type FeatureClass = {
    id: string;
    runtimeInfo?: RuntimeInfo;
    isEngineFeature: boolean;
    dependencies<T extends FeatureClass>(): InstanceType<T>['dependencies'];
    context<T extends FeatureClass>(): InstanceType<T>['context'];
    api<T extends FeatureClass>(this: T): InstanceType<T>['api'];
    new (): FeatureDescriptor;
};

// type SSS = RunningFeatures<[FeatureClass], AnyEnvironment>;
// export type FeatureClass = typeof EngineFeature<string>;

export type FeatureDependencies = ReadonlyArray<FeatureClass>;

export interface FeatureDescriptor {
    id: string;
    api: EntityRecord;
    dependencies: FeatureDependencies;
    context?: Record<string, Context<unknown>>;
}

export type RunningFeatures<T extends FeatureDependencies, E extends AnyEnvironment> = {
    [K in InstanceType<T[number]>['id']]: RunningInstance<Extract<InstanceType<T[number]>, { id: K }>, E>;
};

export type SettingUpFeature<F extends FeatureClass, E extends AnyEnvironment> = {
    id: InstanceType<F>['id'];
    run: (fn: () => unknown) => void;
    onDispose: (fn: () => unknown) => void;
    [RUN_OPTIONS]: IRunOptions;
    [ENGINE]: RuntimeEngine<E>;
} & MapVisibleInputs<InstanceType<F>['api'], GloballyProvidingEnvironments> &
    MapVisibleInputs<InstanceType<F>['api'], E> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<InstanceType<F>['api']>> &
    MapType<GetDependenciesOutput<InstanceType<F>['api'], DeepEnvironmentDeps<E>>> &
    MapToProxyType<FilterNotEnv<GetRemoteOutputs<InstanceType<F>['api']>, DeepEnvironmentDeps<E>, 'providedFrom'>>;

export type SetupHandler<F extends FeatureClass, E extends AnyEnvironment> = (
    feature: SettingUpFeature<F, E>,
    runningFeatures: RunningFeatures<InstanceType<F>['dependencies'], E>,
    context: MapRecordType<InstanceType<F>['context']>
) => RegisteringFeature<InstanceType<F>['api'], OmitCompositeEnvironment<E>>;

export type ContextHandler<
    F extends FeatureClass,
    E extends AnyEnvironment,
    K extends keyof InstanceType<F>['context']
> = (
    runningFeatures: RunningFeatures<InstanceType<F>['dependencies'], E>
) => InstanceType<F>['context'][K] extends Context<infer U> ? U & {} : {};

export type SettingUpFeature2<API extends EntityRecord, E extends AnyEnvironment> = {
    id: string;
    run: (fn: () => unknown) => void;
    onDispose: (fn: () => unknown) => void;
    [RUN_OPTIONS]: IRunOptions;
    [ENGINE]: RuntimeEngine<E>;
} & MapVisibleInputs<API, GloballyProvidingEnvironments> &
    MapVisibleInputs<API, E> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<API>> &
    MapType<GetDependenciesOutput<API, DeepEnvironmentDeps<E>>> &
    MapToProxyType<FilterNotEnv<GetRemoteOutputs<API>, DeepEnvironmentDeps<E>, 'providedFrom'>>;
