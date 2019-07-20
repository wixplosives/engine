import { SERVICE_CONFIG } from '../symbols';

export type SerializableArguments = unknown[];
export type SerializableMethod = (...args: SerializableArguments) => void;

export type EnvironmentTypes = 'window' | 'iframe' | 'worker' | 'node' | 'context';

export interface Target {
    name?: string;
    addEventListener(type: 'message', handler: (event: { data: any }) => void, capture?: boolean): void;
    removeEventListener(type: 'message', handler: (event: { data: any }) => void, capture?: boolean): void;
    postMessage(data: any, origin?: any): void;
}
export type WindowHost = HTMLIFrameElement | Window;

export interface CallbackRecord<T> {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timerId: ReturnType<typeof setTimeout>;
}

export interface EnvironmentRecord {
    id: string;
    host: Target;
}

export type UnknownFunction = (...args: unknown[]) => unknown;

export type AsyncApi<T extends any> = {
    [P in keyof T]: (P extends keyof ServiceConfig<T>
        ? MultiTanentProxyFunction<T, P extends string ? P : never>
        : T[P] extends (...args: infer Args) => infer R
        ? (...args: Args) => ValuePromise<R>
        : never);
};
export interface EnvironmentInstanceToken {
    id: string;
}

export type ValuePromise<R> = R extends Promise<unknown> ? R : Promise<R>;

export type FunctionArgs<T extends any> = T extends (...x: infer Args) => any ? Args : never;

export type ServiceConfig<T extends any> = T[typeof SERVICE_CONFIG];

export type MultiTanentProxyFunction<T extends any, K extends string> = ReturnType<
    ServiceConfig<T>[K]
>['proxyFunction'];

export type FilterFirstArgument<T extends any> = T extends (_a: infer _First, ...rest: infer Args) => unknown
    ? Args
    : never;

export type AnyFunction = (...args: any[]) => any;

export interface APIService {
    [SERVICE_CONFIG]?: Record<string, UnknownFunction>;
    [fnName: string]: any;
}

export interface RemoteAPIServicesMapping {
    [remoteServiceId: string]: APIService;
}
