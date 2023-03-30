import type {
    EnvironmentTypes,
    TopLevelConfig,
    BaseHost,
    Environment,
    AnyEnvironment,
    MultiEnvironment,
} from '@wixc3/engine-core';

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

export interface StartEnvironmentOptions<ENV extends AnyEnvironment = AnyEnvironment>
    extends IEnvironmentDescriptor<ENV> {
    featureName: string;
    bundlePath?: string;
    config?: TopLevelConfig;
    features: Array<[string, Required<IStaticFeatureDefinition>]>;
    options?: Array<[string, string | boolean]>;
    inspect?: boolean;
    host?: BaseHost;
    context?: string;
}

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

export interface IEnvironmentDescriptor<ENV extends AnyEnvironment = AnyEnvironment> {
    type: EnvironmentTypes;
    name: string;
    childEnvName?: string;
    flatDependencies?: IEnvironmentDescriptor<MultiEnvironment<ENV['envType']>>[];
    env: ENV;
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

export interface MetadataCollectionAPI {
    getRuntimeArguments: () => IEngineRuntimeArguments;
}

export interface IEngineRuntimeArguments {
    featureName: string;
    basePath: string;
    outputPath: string;
    configName?: string;
    devport?: number;
    nodeEntryPath: string;
    workerThreadEntryPath: string;
    features: [featureName: string, featureDefinition: Required<IStaticFeatureDefinition>][];
    config: TopLevelConfig;
    requiredModules?: string[];
    runtimeOptions?: StartEnvironmentOptions['options'];
}

export interface IStaticFeatureDefinition {
    contextFilePaths?: Record<string, string>;
    envFilePaths?: Record<string, string>;
    preloadFilePaths?: Record<string, string>;
    dependencies?: string[];
    scopedName: string;
    resolvedContexts?: Record<string, string>;
    packageName: string;
    filePath: string;
    exportedEnvs?: IEnvironmentDescriptor[];
}

export const metadataApiToken = {
    id: 'metadata-api-token',
};

export const isWorkerThreadEnvStartupMessage = (value: unknown): value is IWorkerThreadEnvStartupMessage => {
    return (value as IWorkerThreadEnvStartupMessage).id === 'workerThreadStartupOptions';
};

export type IWorkerThreadEnvStartupMessage = {
    id: 'workerThreadStartupOptions';
    runOptions: NodeEnvironmentStartupOptions;
};

export interface NodeEnvironmentStartupOptions extends IEngineRuntimeArguments {
    environmentContextName?: string;
    devtools?: boolean;
    environmentName: string;
    bundlePath?: string;
    featureDiscoveryRoot?: string;
    parentEnvName: string;
    execPath?: string;
    env: Environment;
}
