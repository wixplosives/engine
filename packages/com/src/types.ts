// TODO: THIS IS LEFTOVER
import { SERVICE_CONFIG } from '@wixc3/engine-core';

export type SerializableArguments = unknown[];
export type SerializableMethod = (...args: SerializableArguments) => void;

export type EnvironmentTypes =
    | 'window'
    | 'iframe'
    | 'worker'
    | 'node'
    | 'context'
    | 'electron-renderer'
    | 'electron-main';
/**
 * TODO: remove onReconnect and onDisconnect
 */
export interface IActiveEnvironment {
    id: string;
    onDisconnect?: (cb: () => void) => void;
    onReconnect?: (cb: () => void) => void;
}

export type Json = boolean | number | string | null | Json[] | { [key: string]: Json };
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

export type AsyncApi<T> = {
    [P in keyof T]: P extends keyof ServiceConfig<T>
        ? MultiTanentProxyFunction<T, P extends string ? P : never>
        : T[P] extends (...args: any[]) => PromiseLike<any>
        ? T[P]
        : T[P] extends (...args: infer Args) => infer R
        ? (...args: Args) => Promise<R>
        : never;
};

export interface EnvironmentInstanceToken {
    id: string;
}

export interface IServiceMethodOptions<T, K> {
    emitOnly?: boolean;
    listener?: boolean;
    removeListener?: Exclude<keyof T, K>;
    removeAllListeners?: Exclude<keyof T, K>;
}

export interface AnyServiceMethodOptions {
    emitOnly?: boolean;
    listener?: boolean;
    removeListener?: string;
    removeAllListeners?: string;
}

export interface ILiveEnvironment {
    id: string;
    onDisconnect?: (cb: () => void) => void;
    onReconnect?: (cb: () => void) => void;
}

export type ServiceComConfig<T> = {
    [K in keyof T]?: T[K] extends (...args: any[]) => unknown ? IServiceMethodOptions<T, K> : never;
};

export type ValuePromise<R> = R extends Promise<unknown> ? R : Promise<R>;

export type ServiceConfig<T extends { [SERVICE_CONFIG]?: any }> = T[typeof SERVICE_CONFIG];

export type MultiTanentProxyFunction<T extends { [SERVICE_CONFIG]?: any }, K extends string> = ReturnType<
    ServiceConfig<T>[K]
>['proxyFunction'];

export type FilterFirstArgument<T> = T extends (_a: infer _First, ...rest: infer Args) => unknown ? Args : never;

export type AnyFunction = (...args: any[]) => unknown;

export interface APIService {
    [SERVICE_CONFIG]?: Record<string, (...args: any[]) => { proxyFunction: AnyFunction }>;
    [fnName: string]: AnyFunction;
}

export interface RemoteAPIServicesMapping {
    [remoteServiceId: string]: Record<string, AnyFunction>;
}

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

export interface LogMetadata {
    [key: string]: unknown;
}

export interface LogMessage {
    /**
     * Actual text of log message.
     */
    message: string;

    /**
     * UTC timestamp when the message was logged (Date.now)
     */
    timestamp: number;

    /**
     * Severity level of the message.
     */
    level: LogLevel;

    /**
     * Optional string map to add to the message.
     */
    metadata?: LogMetadata;
}
