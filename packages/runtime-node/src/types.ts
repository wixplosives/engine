import type { TopLevelConfig, Environment, AnyEnvironment } from '@wixc3/engine-core';
import type { IEnvironmentDescriptor, StartEnvironmentOptions } from '@wixc3/engine-core-node';

export type TopLevelConfigProvider = (envName: string) => TopLevelConfig;

export interface IStaticFeatureDefinition {
    contextFilePaths?: Record<string, string>;
    envFilePaths?: Record<string, string>;
    preloadFilePaths?: Record<string, string>;
    dependencies?: string[];
    /**
     * the feature's name scoped to the package.json package name.
     * @example
     * ```
     * packageName = '@some-scope/my-package'
     * featureName = 'my-feature'
     * scopedName === 'my-package/my-feature'
     * ```
     * if package name is equal to the feature name, then the scoped name will just be the package name
     * if package name ends with - feature, we remove it from the scope
     */
    scopedName: string;
    resolvedContexts?: Record<string, string>;
    packageName: string;
    filePath: string;
    exportedEnvs?: IEnvironmentDescriptor<AnyEnvironment>[];
}

export const isProcessMessage = (value: unknown): value is IProcessMessage<unknown> =>
    typeof value === 'object' && value !== null && typeof (value as IProcessMessage<unknown>).id === 'string';

export type ProcessMessageId =
    | 'run-feature'
    | 'feature-initialized'
    | 'close-feature'
    | 'feature-closed'
    | 'server-disconnect'
    | 'server-disconnected'
    | 'port-request'
    | 'error'
    | 'metrics-request'
    | 'metrics-response';

export interface IProcessMessage<T> {
    id: ProcessMessageId;
    payload: T;
}

export interface ICommunicationMessage {
    id: string;
}

export interface IEnvironmentPortMessage extends ICommunicationMessage {
    id: 'port-request';
    payload: { port: number };
}

export interface IEnvironmentMetricsRequest extends ICommunicationMessage {
    id: 'metrics-request';
}

export type PerformanceMetrics = {
    marks: PerformanceEntry[];
    measures: PerformanceEntry[];
};

export interface IEnvironmentMetricsResponse extends ICommunicationMessage {
    id: 'metrics-response';
    payload: PerformanceMetrics;
}

export interface IEnvironmentMessage extends ICommunicationMessage {
    id: 'start' | 'close';
    envName: string;
}

export interface IEnvironmentStartMessage extends IEnvironmentMessage {
    id: 'start';
    data: StartEnvironmentOptions<Environment>;
}

export interface RemoteProcess {
    on: (event: 'message', handler: (message: ICommunicationMessage) => unknown) => void;
    postMessage: (message: ICommunicationMessage) => unknown;
    terminate?: () => void;
    off: (event: 'message', handler: (message: ICommunicationMessage) => unknown) => void;
}

export const isEnvironmentStartMessage = (message: ICommunicationMessage): message is IEnvironmentStartMessage =>
    message.id === 'start';

export const isEnvironmentCloseMessage = (message: ICommunicationMessage): message is IEnvironmentMessage =>
    message.id === 'close';

export const isEnvironmentPortMessage = (message: ICommunicationMessage): message is IEnvironmentPortMessage =>
    message.id === 'port-request';

export const isEnvironmentMetricsRequestMessage = (
    message: ICommunicationMessage
): message is IEnvironmentMetricsRequest => message.id === 'metrics-request';

export const isEnvironmentMetricsResponseMessage = (
    message: ICommunicationMessage
): message is IEnvironmentMetricsResponse => message.id === 'metrics-response';

export interface IConfigDefinition {
    name: string;
    envName?: string;
    filePath: string;
}
