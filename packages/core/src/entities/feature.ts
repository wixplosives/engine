import { SetMultiMap } from '@wixc3/patterns';
import type { RuntimeEngine } from '../runtime-engine';
import { ENGINE, IDENTIFY_API, RUN_OPTIONS } from '../symbols';
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
    import { Feature, Config } from '@wixc3/engine-core';
    import { FeatureA } from './a.feature';
    import { FeatureB } from './b.feature';

    export class MyFeature extends Feature<'my-feature'> {
        public id = 'my-feature' as const;
        public api = {
            config: Config.withType<{ id: string }>().defineEntity({ id: '' }),
        };
        public dependencies = [FeatureA, FeatureB];
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
    static [IDENTIFY_API] = false; // prevents double identification of apis
    constructor() {
        return ((this.constructor as any).instance ||= this);
    }
    static get id(): string {
        return validateRegistration(instantiateFeature(this));
    }
    static dependencies<T extends FeatureClass>(): InstanceType<T>['dependencies'] {
        return instantiateFeature(this).dependencies;
    }
    static api<T extends FeatureClass>(this: T): InstanceType<T>['api'] {
        return instantiateFeature(this).api;
    }
    static context<T extends FeatureClass>(this: T): InstanceType<T>['context'] {
        return instantiateFeature(this).context;
    }
    static use<T extends FeatureClass>(this: T, c: PartialFeatureConfig<InstanceType<T>['api']>) {
        return provideConfig(this, c);
    }
    static setup<T extends FeatureClass, E extends AnyEnvironment>(
        this: T,
        environment: E,
        setupHandler: SetupHandler<T, E>
    ): T {
        return setup(this, environment, setupHandler);
    }
    static setupContext<
        T extends FeatureClass,
        E extends AnyEnvironment,
        C extends keyof InstanceType<T>['context'] & string
    >(this: T, environment: E, context: C, setupHandler: ContextHandler<T, E, C>): T {
        return setupContext(this, environment, context, setupHandler);
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

/**
 * assume that feature is singleton we can run identity check on the api once
 */
export function instantiateFeature<T extends FeatureClass>(FeatureClass: T) {
    const feature = new FeatureClass();
    const PreventDoubleCheck = FeatureClass as { [IDENTIFY_API]?: boolean };
    if (PreventDoubleCheck[IDENTIFY_API]) {
        return feature;
    }
    PreventDoubleCheck[IDENTIFY_API] = true;
    for (const [key, api] of Object.entries(feature.api)) {
        const entityFn = api[IDENTIFY_API];
        if (entityFn) {
            entityFn.call(api, feature.id, key);
        }
    }
    return feature;
}

function testEnvironmentCollision(envVisibility: EnvVisibility, envSet: Set<string>): string[] {
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
        throw new Error('Feature must have a const id provided');
    }
    return feature.id;
}

type RuntimeInfo = {
    setups: SetMultiMap<string, SetupHandler<any, any>>;
    contexts: Map<string, ContextHandler<any, any, any>>;
    envs: Set<string>;
};

export interface FeatureClass {
    new (): FeatureDescriptor;
    id: string;
    runtimeInfo?: RuntimeInfo;
    isEngineFeature: boolean;
    dependencies<T extends FeatureClass>(): InstanceType<T>['dependencies'];
    context<T extends FeatureClass>(): InstanceType<T>['context'];
    api<T extends FeatureClass>(this: T): InstanceType<T>['api'];
}

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

export type SettingUpFeatureBase<F extends FeatureClass, E extends AnyEnvironment> = {
    id: InstanceType<F>['id'];
    run: (fn: () => unknown) => void;
    onDispose: (fn: () => unknown) => void;
    [RUN_OPTIONS]: IRunOptions;
    [ENGINE]: RuntimeEngine<E>;
};

export type SettingUpFeature<F extends FeatureClass, E extends AnyEnvironment> = SettingUpFeatureBase<F, E> &
    MapVisibleInputs<InstanceType<F>['api'], GloballyProvidingEnvironments> &
    MapVisibleInputs<InstanceType<F>['api'], E> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<InstanceType<F>['api']>> &
    MapType<GetDependenciesOutput<InstanceType<F>['api'], DeepEnvironmentDeps<E>>> &
    MapToProxyType<FilterNotEnv<GetRemoteOutputs<InstanceType<F>['api']>, DeepEnvironmentDeps<E>, 'providedFrom'>>;

export type SetupHandler<F extends FeatureClass, E extends AnyEnvironment> = (
    feature: SettingUpFeature<F, E>,
    runningFeatures: RunningFeatures<InstanceType<F>['dependencies'], E>,
    context: MapRecordType<NonNullable<InstanceType<F>['context']>>
) => RegisteringFeature<InstanceType<F>['api'], OmitCompositeEnvironment<E>>;

export type ContextHandler<
    F extends FeatureClass,
    E extends AnyEnvironment,
    K extends keyof InstanceType<F>['context']
> = (
    runningFeatures: RunningFeatures<InstanceType<F>['dependencies'], E>
) => InstanceType<F>['context'][K] extends Context<infer U> ? U & {} : {};
