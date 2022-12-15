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

export function createRuntimeInfo(): RuntimeInfo {
    return {
        setup: new SetMultiMap(),
        context: new Map(),
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
    info.setup.add(environment.env, setupHandler);
}

export function setupContext<T extends FeatureDescriptor, E extends AnyEnvironment, K extends keyof T['context']>(
    feature: T,
    _environment: E, // TODO: add handlers in environments buckets with validation per environment?
    environmentContextKey: K,
    contextHandler: ContextHandler<T, E, K>
) {
    const info = (feature.runtimeInfo ||= createRuntimeInfo());
    validateNoDuplicateContextRegistration(environmentContextKey, feature.id, info.context);
    info.context.set(environmentContextKey, contextHandler);
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
    environmentContext: string | number | symbol,
    featureId: string,
    contextHandlers: Map<string | number | symbol, ContextHandler<any, any, any>>
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

type RuntimeInfo = {
    setup: SetMultiMap<string, SetupHandler<any, any>>;
    context: Map<string | number | symbol, ContextHandler<any, any, any>>;
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

export type RunningFeaturesV2<T extends FeatureDependencies, E extends AnyEnvironment> = {
    [K in T[number]['id']]: Running<Extract<T[number], { id: K }>, E>;
};

type SettingUpFeature<F extends FeatureDescriptor, E extends AnyEnvironment> = {
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
    runningFeatures: RunningFeaturesV2<F['dependencies'], E>,
    context: MapRecordType<F['context']>
) => RegisteringFeature<F['api'], OmitCompositeEnvironment<E>>;

export type ContextHandler<F extends FeatureDescriptor, E extends AnyEnvironment, K extends keyof F['context']> = (
    runningFeatures: RunningFeaturesV2<F['dependencies'], E>
) => F['context'][K] extends Context<infer U> ? U & {} : {};
