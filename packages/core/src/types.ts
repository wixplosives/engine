import { EQUAL, TuppleToUnion as TupleToUnion } from 'typescript-type-utils';
import { LogMessage } from './common-types';
import { Config } from './entities/config';
import { AllEnvironments, Universal } from './entities/env';
import { Feature, RuntimeFeature } from './entities/feature';
import { RuntimeEngine } from './runtime-engine';
import { CREATE_RUNTIME, REGISTER_VALUE } from './symbols';

/*************** TEST KIT  ***************/

export function type_check<U extends true, T extends (...args: U[]) => U>(_fn: T) {
    /* */
}

/*************** HELPER TYPES  ***************/

export type MapBy<T extends any[] | undefined, FIELD extends keyof TupleToUnion<T>> = {
    [key in TupleToUnion<T>[FIELD]]: Extract<TupleToUnion<T>, { [exc in FIELD]: key }>;
};

type JustFilterKeys<T, Filter> = ({ [P in keyof T]: T[P] extends Filter ? P : never })[keyof T];
type JustFilter<T, Filter> = Pick<T, JustFilterKeys<T, Filter>>;
// type JustFilterReverse<T, Filter> = Pick<T, Exclude<keyof T, JustFilterKeys<T, Filter>>>

/*************** ENGINE TYPES  ***************/

export interface IDTag<T extends string> {
    id: T;
}

export type IDTagArray = Array<IDTag<string>>;

export type EntityDefModes = 'input' | 'output';

export type DisposeFunction = () => unknown;

export interface Entity<
    TYPE,
    PROXY_TYPE,
    ProvidedFrom extends EnvVisibility,
    VisibleAt extends EnvVisibility,
    Mode extends EntityDefModes,
    RemoteAccess extends boolean
> {
    type: TYPE;
    proxyType: PROXY_TYPE;
    providedFrom: ProvidedFrom;
    visibleAt: VisibleAt;
    mode: Mode;
    remoteAccess: RemoteAccess;
    [REGISTER_VALUE]: (
        context: RuntimeEngine,
        providedValue: TYPE | undefined,
        inputValue: PROXY_TYPE,
        featureID: string,
        entityKey: string
    ) => PROXY_TYPE;
    [CREATE_RUNTIME]: (context: RuntimeEngine, featureID: string, entityKey: string) => TYPE | PROXY_TYPE | void;
}

type AnyEntity = Entity<any, any, EnvVisibility, EnvVisibility, EntityDefModes, boolean>;
type AnyOutput = Entity<any, any, any, any, 'output', boolean>;
type OnlyLocalUniversalOutput = Entity<any, any, typeof Universal, any, 'output', false>;

type AnyRemote = Entity<any, any, any, any, any, true>;
type AnyInput = Entity<any, any, any, any, 'input', false>;
// TODO: fix me
// type AnyNonRemoteOutput = Entity<any, never, any, any, 'output'>

export type GetInputs<T extends EntityMap> = JustFilter<T, AnyInput>;
export type GetOutputs<T extends EntityMap> = JustFilter<T, AnyOutput>;

// export type GetRemoteOutputs<T extends EntityMap> = JustFilterReverse<GetOutputs<T>, AnyNonRemoteOutput>
export type GetRemoteOutputs<T extends EntityMap> = JustFilter<T, AnyRemote>;
export type GetOnlyLocalUniversalOutputs<T extends EntityMap> = JustFilter<T, OnlyLocalUniversalOutput>;

export type SomeFeature = Feature<any, any, any, any>;
export type SomeRuntimeFeature = RuntimeFeature<any, any, any>;

export interface EntityMap {
    [key: string]: AnyEntity;
}

export type EnvironmentFilter = string | { env: string };
export type NormalizeEnvironmentFilter<T extends EnvironmentFilter> = T extends { env: infer U1 } ? U1 : T;

export type EnvVisibility = string | { env: string; envType?: string } | Array<{ env: string; envType?: string }>;

export type EnvType<T extends EnvVisibility> = T extends []
    ? AllEnvironments['env']
    : T extends Array<{ env: infer U }>
    ? U
    : T extends { env: infer U1 }
    ? U1
    : T;

type FilterENVKeys<T extends any, ENV extends string, Key extends 'visibleAt' | 'providedFrom'> = ({
    [P in keyof T]: ENV extends EnvType<T[P][Key]> ? P : never;
})[keyof T];

type FilterEnv<T extends EntityMap, EnvFilter extends string, Key extends 'visibleAt' | 'providedFrom'> = Pick<
    T,
    FilterENVKeys<T, EnvFilter, Key>
>;

// type HideEnv<T extends EntityMap, EnvFilter extends string, Key extends 'visibleAt' | 'providedFrom'> = Pick<
//     T,
//     Exclude<keyof T, FilterENVKeys<T, EnvFilter, Key>>
// >

// prettier-ignore
type MapType<X extends EntityMap> = ({ [k in keyof X]: X[k]['type'] });
type MapRecordType<X extends Record<string, { type: any }>> = { [k in keyof X]: X[k]['type'] };

// prettier-ignore
export type MapToProxyType<T extends EntityMap> = ({
    [K in keyof T]: T[K]['proxyType']
});
// prettier-ignore
export type MapToPartialType<T extends { [k: string]: any }> = ({ [K in keyof T]: Partial<T[K]['type']> });

type MapProxyTypesForEnv<
    T extends EntityMap,
    EnvFilter extends string,
    Key extends 'visibleAt' | 'providedFrom'
> = MapToProxyType<FilterEnv<T, EnvFilter, Key>>;

type MapTypesForEnv<T extends EntityMap, EnvFilter extends string, Key extends 'visibleAt' | 'providedFrom'> = MapType<
    FilterEnv<T, EnvFilter, Key>
>;

type MapVisibleInputs<T extends EntityMap, EnvFilter extends string> = MapType<
    FilterEnv<GetInputs<T>, EnvFilter, 'visibleAt'>
>;

export interface FeatureDef<
    ID extends string,
    Deps extends SomeFeature[],
    API extends EntityMap,
    EnvironmentContext extends Record<string, Context<any>>
> {
    id: ID;
    dependencies?: Deps;
    api: API;
    context?: EnvironmentContext;
}

export type UnknownFeatureDef = FeatureDef<string, SomeFeature[], EntityMap, Record<string, Context<any>>>;
export type Running<T extends UnknownFeatureDef, ENV extends string> = MapProxyTypesForEnv<
    T['api'],
    ENV | EnvType<typeof Universal>,
    'visibleAt'
>;

// prettier-ignore
export type RunningFeatures<
    T extends SomeFeature[],
    ENV extends string,
    FeatureMap extends MapBy<T, 'id'> = MapBy<T, 'id'>
    > = ({ [I in keyof FeatureMap]: Running<FeatureMap[I], ENV> });

// prettier-ignore
type SettingUpFeature<ID extends string, API extends EntityMap, ENV extends string> = ({
    id: ID
    run: (fn: () => unknown) => void
    onDispose: (fn: DisposeFunction) => void
} & MapVisibleInputs<API, ENV> &
    MapToProxyType<GetRemoteOutputs<API>> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<API>>);

// prettier-ignore
export type RegisteringFeature<
    API extends EntityMap,
    ENV extends string,
    ProvidedOutputs extends MapTypesForEnv<GetOutputs<API>, ENV, 'providedFrom'> = MapTypesForEnv<
        GetOutputs<API>,
        ENV,
        'providedFrom'
    >
> = keyof ProvidedOutputs extends never ? null : ProvidedOutputs;

export interface SetupHandlerEnvironmentContext<EnvironmentContext extends Record<string, Context<any>>> {
    context: EnvironmentContext;
}

export interface Context<T> {
    type: T;
}

export interface IContextDispose {
    dispose?: DisposeFunction;
}

export interface IDisposable {
    /**
     * disposes the instance removing all event listeners
     */
    dispose(): void;

    /**
     * is the instance disposed
     */
    isDisposed(): boolean;
}

export type DisposableContext<T> = Context<T & IContextDispose>;

export type SetupHandler<
    EnvFilter extends EnvironmentFilter,
    ID extends string,
    Deps extends SomeFeature[],
    API extends EntityMap,
    EnvironmentContext extends Record<string, Context<any>>,
    Filter extends NormalizeEnvironmentFilter<EnvFilter> = NormalizeEnvironmentFilter<EnvFilter>
> = (
    feature: SettingUpFeature<ID, API, Filter>,
    runningFeatures: RunningFeatures<Deps, Filter>,
    context: MapRecordType<EnvironmentContext>
) => RegisteringFeature<API, Filter>;

export type PartialFeatureConfig<API> = Partial<MapToPartialType<JustFilter<API, Config<any>>>>;

export type TopLevelConfig = Array<[string, object]>;

// tslint:disable-next-line:no-namespace
export declare namespace Tests {
    export type FromString = EQUAL<EnvType<'main'>, 'main'>;
    export type FromEnvArray = EQUAL<EnvType<[{ env: 'main' }]>, 'main'>;
    export type FromEnv = EQUAL<EnvType<{ env: 'main' }>, 'main'>;
    export type FromEnvArrayMultiple = EQUAL<EnvType<[{ env: 'main' }, { env: 'main1' }]>, 'main' | 'main1'>;
    export type FromEnvEmptyArray = EQUAL<EnvType<[]>, any>;

    export type RunningEmpty = EQUAL<Running<{ id: ''; api: {} }, 'main'>, {}>;
    export type RunningProvidesApiInputTypes = EQUAL<
        Running<{ id: ''; api: { x: Entity<string, string, 'main', 'main', 'input', false> } }, 'main'>,
        { x: string }
    >;
    export type RunningProvidesApiOutputTypes = EQUAL<
        Running<{ id: ''; api: { x: Entity<string, string, 'main', 'main', 'output', false> } }, 'main'>,
        { x: string }
    >;
}

export interface LoggerTransport {
    name: string;
    handleMessage: (m: LogMessage) => void;
}

export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}
