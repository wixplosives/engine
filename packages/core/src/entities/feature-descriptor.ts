import { SetMultiMap } from '@wixc3/common';
import type { RuntimeEngine } from '../runtime-engine';
import type { ENGINE, RUN_OPTIONS } from '../symbols';
import type {
    Context,
    DeepEnvironmentDeps,
    EntityRecord,
    FilterNotEnv,
    GetDependenciesOutput,
    GetOnlyLocalUniversalOutputs,
    GetRemoteOutputs,
    IRunOptions,
    MapRecordType,
    MapToProxyType,
    MapType,
    MapVisibleInputs,
    Running,
} from '../types';
import type { AnyEnvironment, Environment, GloballyProvidingEnvironments } from './env';

type RuntimeInfo = {
    setup: SetMultiMap<string, SetupHandlerV2<any, any>>;
    context: Map<string | number | symbol, ContextHandlerV2<any, any, any>>;
};

export function createRuntimeInfo(): RuntimeInfo {
    return {
        setup: new SetMultiMap(),
        context: new Map(),
    };
}

export function setup<T extends FeatureDescriptor, E extends Environment>(
    FeatureConstructor: T,
    environment: E,
    setupHandler: SetupHandlerV2<T, E>
) {
    // TODO: add the validation
    const info = (FeatureConstructor.runtimeInfo ||= createRuntimeInfo());
    info.setup.add(environment.env, setupHandler);
}

export function setupContext<T extends FeatureDescriptor, E extends Environment, K extends keyof T['context']>(
    FeatureConstructor: T,
    _environment: E, // TODO: add handlers in environments buckets with validation per environment?
    environmentContextKey: K,
    contextHandler: ContextHandlerV2<T, E, K>
) {
    // TODO: add the validation
    const info = (FeatureConstructor.runtimeInfo ||= createRuntimeInfo());
    info.context.set(environmentContextKey, contextHandler);
}

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

type SettingUpFeatureV2<F extends FeatureDescriptor, E extends Environment> = {
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

export type SetupHandlerV2<F extends FeatureDescriptor, E extends Environment> = (
    feature: SettingUpFeatureV2<F, E>,
    runningFeatures: RunningFeaturesV2<F['dependencies'], E>,
    // TODO: test this
    context: MapRecordType<F['context']>
) => any;

export type ContextHandlerV2<F extends FeatureDescriptor, E extends Environment, K extends keyof F['context']> = (
    runningFeatures: RunningFeaturesV2<F['dependencies'], E>
) => F['context'][K];

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// const mainEnv = new Environment('main', 'window', 'single');
// const processingWorker = new Environment('processing-worker', 'worker', 'single');
// const processingEnv = new SingleEndpointContextualEnvironment('processing', [processingWorker]);

// export class Compilation {
//     static id = 'Compilation' as const;
//     static dependencies = [];
//     static api = {
//         compilers: Slot.withType<(filePath: string) => string>().defineEntity(processingEnv),
//         someService: Service.withType<{ run(): string }>().defineEntity(mainEnv),
//     };
// }

// class Compilation2 {
//     static id = 'Compilation2' as const;
//     static dependencies = [];
//     static api = {
//         compilers2: Slot.withType<(filePath: string) => string>().defineEntity(processingEnv),
//         someService2: Service.withType<{ run(): string }>().defineEntity(mainEnv),
//     };
// }

// class Typescript {
//     static id = 'Typescript' as const;
//     static dependencies = [Compilation, Compilation2];
//     static api = {};
//     static context = {
//         processingContext: processingEnv.withContext<{ name: string }>(),
//     };
// }

// setup(Typescript, mainEnv, (feature, runningFeatures, context) => {
//     runningFeatures.Compilation.someService.run();
//     runningFeatures.Compilation2.someService2.run();

//     context.processingContext.name;

//     console.log(feature, runningFeatures, context);
// });
