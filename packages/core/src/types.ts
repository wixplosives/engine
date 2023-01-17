import type { LogMessage } from './common-types';
import type { AnyEnvironment, Environment, GloballyProvidingEnvironments, Universal } from './entities/env';
import type { FeatureClass, FeatureDependencies } from './entities/feature-descriptor';
import type { RuntimeEngine } from './runtime-engine';
import { CONFIGURABLE, CREATE_RUNTIME, IDENTIFY_API, REGISTER_VALUE } from './symbols';

/*************** HELPER TYPES  ***************/
type TupleToUnion<T> = T extends ReadonlyArray<infer ITEMS> ? ITEMS : never;

export type MapBy<T extends readonly any[] | undefined, FIELD extends keyof TupleToUnion<T>> = {
    [key in TupleToUnion<T>[FIELD]]: Extract<TupleToUnion<T>, { [exc in FIELD]: key }>;
};

export type FilterRecord<T, Filter> = { [P in keyof T as T[P] extends Filter ? P : never]: T[P] };

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

export type GetInputs<T extends EntityRecord> = FilterRecord<T, Entity<any, any, any, any, 'input', false>>;
export type GetOutputs<T extends EntityRecord> = FilterRecord<T, Entity<any, any, any, any, 'output', boolean>>;

export type GetRemoteOutputs<T extends EntityRecord> = FilterRecord<T, Entity<any, any, any, any, any, true>>;

export type GetDependenciesOutput<T extends EntityRecord, EnvDeps extends EnvVisibility> = FilterRecord<
    T,
    Entity<any, any, EnvDeps, any, any, any>
>;

export type GetOnlyLocalUniversalOutputs<T extends EntityRecord> = FilterRecord<
    T,
    Entity<any, any, typeof Universal, any, 'output', false>
>;

export interface EntityRecord {
    [key: string]: Entity;
}

type DeepEnvNameDepsTuple<T extends AnyEnvironment> = [
    T['dependencies'][number]['env'],
    DeepEnvNameDepsTuple<T['dependencies'][number]>
];

export type DeepEnvDepsTuple<T extends AnyEnvironment> = [
    T['dependencies'][number],
    DeepEnvDepsTuple<T['dependencies'][number]>
];

export type Flatten<T extends any[]> = {
    [K in keyof T]: T[K] extends any[] ? T[K][0] : T[K];
};

export type DeepEnvironmentNamesDeps<Env extends AnyEnvironment> = Flatten<DeepEnvNameDepsTuple<Env>>[number];

export type DeepEnvironmentDeps<Env extends AnyEnvironment> = Flatten<DeepEnvDepsTuple<Env>>[number];

export type ReferencedEnvironments<ENV extends AnyEnvironment> = ENV['env'] | DeepEnvironmentNamesDeps<ENV>;

export type EnvVisibility = AnyEnvironment | Array<AnyEnvironment>;

export type EnvType<T extends EnvVisibility> = T extends Array<{ env: infer U }>
    ? U extends string
        ? U
        : never
    : T extends { env: infer U1 }
    ? U1 extends string
        ? U1
        : never
    : never;

type FilterENVKeys<T extends EntityRecord, ENV extends AnyEnvironment, Key extends 'visibleAt' | 'providedFrom'> = {
    [P in keyof T]: EnvType<T[P][Key]> & ReferencedEnvironments<ENV> extends never ? never : P;
}[keyof T];

export type FilterEnv<
    T extends EntityRecord,
    EnvFilter extends AnyEnvironment,
    Key extends 'visibleAt' | 'providedFrom'
> = Pick<T, FilterENVKeys<T, EnvFilter, Key>>;

export type FilterNotENVKeys<
    T extends EntityRecord,
    ENV extends AnyEnvironment,
    Key extends 'visibleAt' | 'providedFrom'
> = {
    [P in keyof T]: EnvType<T[P][Key]> extends ReferencedEnvironments<ENV> ? never : P;
}[keyof T];

export type FilterNotEnv<
    T extends EntityRecord,
    EnvFilter extends AnyEnvironment,
    Key extends 'visibleAt' | 'providedFrom'
> = Pick<T, FilterNotENVKeys<T, EnvFilter, Key>>;

export type MapType<X extends EntityRecord> = { [k in keyof X]: X[k]['type'] };
export type MapRecordType<X> = X extends Record<string, { type: any }> ? { [k in keyof X]: X[k]['type'] } : {};

export type MapToProxyType<T extends EntityRecord> = {
    [K in keyof T]: T[K]['proxyType'];
};
export type MapToPartialType<T extends { [k: string]: any }> = { [K in keyof T]: Partial<T[K]['type']> };

export type MapAllTypesForEnv<T extends EntityRecord, EnvFilter extends AnyEnvironment> = MapToProxyType<
    FilterEnv<
        FilterNotEnv<T, EnvFilter | typeof Universal, 'providedFrom'>,
        EnvFilter | GloballyProvidingEnvironments,
        'visibleAt'
    >
> &
    MapType<FilterEnv<T, EnvFilter | typeof Universal, 'providedFrom'>>;

// type StringKeys<T> = Exclude<keyof T, number | symbol>;
// type MapProxyTypesForEnv<
//     T extends EntityRecord,
//     EnvFilter extends string,
//     Key extends 'visibleAt' | 'providedFrom'
// > = MapToProxyType<FilterEnv<T, EnvFilter, Key>>;

type MapTypesForEnv<
    T extends EntityRecord,
    EnvFilter extends AnyEnvironment,
    Key extends 'visibleAt' | 'providedFrom'
> = MapType<FilterEnv<T, EnvFilter, Key>>;

export type MapVisibleInputs<T extends EntityRecord, EnvFilter extends AnyEnvironment> = MapType<
    FilterEnv<GetInputs<T>, EnvFilter, 'visibleAt'>
>;

export interface FeatureDef<
    ID extends string,
    Deps extends FeatureDependencies,
    API extends EntityRecord,
    EnvironmentContext extends Record<string, Context<any>>
> {
    id: ID;
    dependencies?: Deps;
    api: API;
    context?: EnvironmentContext;
}

export type Running<T extends FeatureClass, ENV extends AnyEnvironment> = MapAllTypesForEnv<
    InstanceType<T>['api'],
    ENV
>;

export type RunningInstance<T extends { api: EntityRecord }, ENV extends AnyEnvironment> = MapAllTypesForEnv<
    T['api'],
    ENV
>;

export interface IRunOptions {
    has(key: string): boolean;
    get(key: string): string | boolean | null | undefined;
}

export type RegisteringFeature<
    API extends EntityRecord,
    ENV extends AnyEnvironment,
    ProvidedOutputs extends MapTypesForEnv<GetOutputs<API>, ENV, 'providedFrom'> = MapTypesForEnv<
        GetOutputs<API>,
        ENV,
        'providedFrom'
    >
> = keyof ProvidedOutputs extends never ? undefined | void : ProvidedOutputs;

export interface Context<T> {
    type: T & { dispose?: DisposeFunction };
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

export type OmitCompositeEnvironment<T extends AnyEnvironment> = Environment<
    T['env'],
    T['envType'],
    T['endpointType'],
    []
>;

export interface Configurable<T> {
    [CONFIGURABLE]: true;
    readonly defaultValue: T;
}

export type PartialFeatureConfig<API> = {
    [key in keyof API as API[key] extends Configurable<any> ? key : never]?: API[key] extends Configurable<infer T>
        ? Partial<T>
        : never;
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
