import type { TupleToUnion } from 'typescript-type-utils';
import type { LogMessage } from './common-types';
import type { Universal } from './entities/env';
import type { Feature } from './entities/feature';
import type { RuntimeEngine } from './runtime-engine';
import { CONFIGURABLE, CREATE_RUNTIME, IDENTIFY_API, REGISTER_VALUE, RUN_OPTIONS } from './symbols';

/*************** HELPER TYPES  ***************/

export type MapBy<T extends any[] | undefined, FIELD extends keyof TupleToUnion<T>> = {
    [key in TupleToUnion<T>[FIELD]]: Extract<TupleToUnion<T>, { [exc in FIELD]: key }>;
};

type JustFilterKeys<T, Filter> = { [P in keyof T]: T[P] extends Filter ? P : never }[keyof T];
type JustFilter<T, Filter> = Pick<T, JustFilterKeys<T, Filter>>;
// type JustFilterReverse<T, Filter> = Pick<T, Exclude<keyof T, JustFilterKeys<T, Filter>>>

/*************** ENGINE TYPES  ***************/

export interface IDTag<T extends string = string> {
    id: T;
}

export type EntityDefModes = 'input' | 'output';

export type DisposeFunction = () => unknown;

export interface Entity<
    TYPE = any,
    PROXY_TYPE = TYPE,
    ProvidedFrom extends EnvVisibility = EnvVisibility,
    VisibleAt extends EnvVisibility = EnvVisibility,
    Mode extends EntityDefModes = EntityDefModes,
    RemoteAccess extends boolean = boolean
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
    [IDENTIFY_API]?: (featureID: string, entityKey: string) => void;
}

export type GetInputs<T extends EntityRecord> = JustFilter<T, Entity<any, any, any, any, 'input', false>>;
export type GetOutputs<T extends EntityRecord> = JustFilter<T, Entity<any, any, any, any, 'output', boolean>>;

export type GetRemoteOutputs<T extends EntityRecord> = JustFilter<T, Entity<any, any, any, any, any, true>>;
export type GetOnlyLocalUniversalOutputs<T extends EntityRecord> = JustFilter<
    T,
    Entity<any, any, typeof Universal, any, 'output', false>
>;

export interface EntityRecord {
    [key: string]: Entity;
}

export type EnvironmentFilter = string | { env: string };
export type NormalizeEnvironmentFilter<T extends EnvironmentFilter> = T extends { env: infer U1 }
    ? U1
    : T extends string
    ? T
    : never;

export type EnvVisibility = string | { env: string; envType?: string } | Array<{ env: string; envType?: string }>;

export type EnvType<T extends EnvVisibility> = T extends []
    ? string
    : T extends Array<{ env: infer U }>
    ? U
    : T extends { env: infer U1 }
    ? U1
    : T;

type FilterENVKeys<T extends EntityRecord, ENV extends string, Key extends 'visibleAt' | 'providedFrom'> = {
    [P in keyof T]: ENV extends EnvType<T[P][Key]> ? P : never;
}[keyof T];

type FilterEnv<T extends EntityRecord, EnvFilter extends string, Key extends 'visibleAt' | 'providedFrom'> = Pick<
    T,
    FilterENVKeys<T, EnvFilter, Key>
>;

type FilterNotENVKeys<T extends EntityRecord, ENV extends string, Key extends 'visibleAt' | 'providedFrom'> = {
    [P in keyof T]: ENV extends EnvType<T[P][Key]> ? never : P;
}[keyof T];

type FilterNotEnv<T extends EntityRecord, EnvFilter extends string, Key extends 'visibleAt' | 'providedFrom'> = Pick<
    T,
    FilterNotENVKeys<T, EnvFilter, Key>
>;

type MapType<X extends EntityRecord> = { [k in keyof X]: X[k]['type'] };
type MapRecordType<X extends Record<string, { type: any }>> = { [k in keyof X]: X[k]['type'] };

export type MapToProxyType<T extends EntityRecord> = {
    [K in keyof T]: T[K]['proxyType'];
};
export type MapToPartialType<T extends { [k: string]: any }> = { [K in keyof T]: Partial<T[K]['type']> };

export type MapAllTypesForEnv<T extends EntityRecord, EnvFilter extends string> = MapToProxyType<
    FilterEnv<FilterNotEnv<T, EnvFilter, 'providedFrom'>, EnvFilter | typeof Universal['env'], 'visibleAt'>
> &
    MapType<FilterEnv<T, EnvFilter | typeof Universal['env'], 'providedFrom'>>;

// type StringKeys<T> = Exclude<keyof T, number | symbol>;
// type MapProxyTypesForEnv<
//     T extends EntityRecord,
//     EnvFilter extends string,
//     Key extends 'visibleAt' | 'providedFrom'
// > = MapToProxyType<FilterEnv<T, EnvFilter, Key>>;

type MapTypesForEnv<
    T extends EntityRecord,
    EnvFilter extends string,
    Key extends 'visibleAt' | 'providedFrom'
> = MapType<FilterEnv<T, EnvFilter, Key>>;

type MapVisibleInputs<T extends EntityRecord, EnvFilter extends string> = MapType<
    FilterEnv<GetInputs<T>, EnvFilter, 'visibleAt'>
>;

export interface FeatureDef<
    ID extends string,
    Deps extends Feature[],
    API extends EntityRecord,
    EnvironmentContext extends Record<string, Context<any>>
> {
    id: ID;
    dependencies?: Deps;
    api: API;
    context?: EnvironmentContext;
}

export type UnknownFeatureDef = FeatureDef<string, Feature[], EntityRecord, Record<string, Context<any>>>;
export type Running<T extends UnknownFeatureDef, ENV extends string> = MapAllTypesForEnv<T['api'], ENV>;

export type RunningFeatures<
    T extends Feature[],
    ENV extends string,
    FeatureMap extends MapBy<T, 'id'> = MapBy<T, 'id'>
> = { [I in keyof FeatureMap]: Running<FeatureMap[I], ENV> };

export interface IRunOptions {
    has(key: string): boolean;
    get(key: string): string | boolean | null | undefined;
}

type RunningEnvironmentNameForUniversal<ENV> = ENV extends '<Universal>'
    ? {
          /**
           * The name of the current running environment while setting up a universal feature.
           * This is NOT the environment instance id
           */
          runningEnvironmentName: string;
      }
    : {};

export type SettingUpFeature<ID extends string, API extends EntityRecord, ENV extends string> = {
    id: ID;
    run: (fn: () => unknown) => void;
    onDispose: (fn: DisposeFunction) => void;
    [RUN_OPTIONS]: IRunOptions;
} & MapVisibleInputs<API, '<Universal>'> &
    MapVisibleInputs<API, ENV> &
    MapToProxyType<GetRemoteOutputs<API>> &
    MapToProxyType<GetOnlyLocalUniversalOutputs<API>> &
    RunningEnvironmentNameForUniversal<ENV>;

export type RegisteringFeature<
    API extends EntityRecord,
    ENV extends string,
    ProvidedOutputs extends MapTypesForEnv<GetOutputs<API>, ENV, 'providedFrom'> = MapTypesForEnv<
        GetOutputs<API>,
        ENV,
        'providedFrom'
    >
> = keyof ProvidedOutputs extends never ? undefined | void : ProvidedOutputs;

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
    Deps extends Feature[],
    API extends EntityRecord,
    EnvironmentContext extends Record<string, Context<any>>,
    Filter extends NormalizeEnvironmentFilter<EnvFilter> = NormalizeEnvironmentFilter<EnvFilter>
> = (
    feature: SettingUpFeature<ID, API, Filter>,
    runningFeatures: RunningFeatures<Deps, Filter>,
    context: MapRecordType<EnvironmentContext>
) => RegisteringFeature<API, Filter>;

export type ContextHandler<
    C,
    EnvFilter extends EnvironmentFilter,
    Deps extends Feature[],
    Filter extends NormalizeEnvironmentFilter<EnvFilter> = NormalizeEnvironmentFilter<EnvFilter>
> = (runningFeatures: RunningFeatures<Deps, Filter>) => C;

export interface Configurable<T> {
    [CONFIGURABLE]: true;
    defaultValue: Readonly<T>;
}

export type PartialFeatureConfig<API> = {
    [key in keyof API]?: API[key] extends Configurable<infer T> ? Partial<T> : never;
};

export type TopLevelConfig = Array<[string, object]>;

export interface LoggerTransport {
    name: string;
    handleMessage: (m: LogMessage) => void;
}

export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}
