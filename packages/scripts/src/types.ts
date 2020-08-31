import type {
    Environment,
    EnvironmentContext,
    EnvironmentTypes,
    TopLevelConfig,
    Feature,
    Target,
} from '@wixc3/engine-core';

export type JSRuntime = 'web' | 'webworker' | 'node';

export type TopLevelConfigProvider = (envName: string) => TopLevelConfig;

export interface IFeatureTarget {
    featureName?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
}

export interface StartEnvironmentOptions extends IEnvironment {
    featureName: string;
    config?: TopLevelConfig;
    features: Array<[string, IFeatureDefinition]>;
    options?: Array<[string, string | boolean]>;
    inspect?: boolean;
    host?: Target;
}
export interface VirtualEntry {
    source: string;
    filename: string;
}

export interface EngineEnvironmentDef {
    name: string;
    target: JSRuntime;
    featureMapping: FeatureMapping;
    envFiles: Set<string>;
    contextFiles?: ReadonlySet<string>;
    currentFeatureName: string;
    currentConfigName: string;
    publicPath?: string;
    environmentContexts?: Record<string, string>;
}

export interface EngineContextDef {
    name: string;
    target: JSRuntime;
    featureMapping: FeatureMapping;
    contextFiles: Set<string>;
    currentFeatureName: string;
    currentConfigName: string;
    publicPath?: string;
}

export interface EngineEnvironmentEntry {
    name: string;
    target: JSRuntime;
    isRoot: boolean;
    envFiles: Set<string>;
    featureMapping: FeatureMapping;
    entryFilename: string;
    contextFiles?: Set<string>;
}

export interface WebpackEnvOptions {
    port?: number;
    environments: EngineEnvironmentEntry[];
    contextFiles?: Set<string>;
    basePath: string;
    outputPath: string;
}

export interface SingleFeatureWithConfig {
    featureFilePath: string;
    configurations: { [configName: string]: string };
    context: { [contextName: string]: string };
}

export type SymbolList<T> = Array<{ name: string; value: T }>;

export interface EvaluatedFeature {
    id: string;
    filePath: string;
    features: SymbolList<Feature>;
    environments: SymbolList<Environment>;
    contexts: SymbolList<EnvironmentContext>;
}

export interface FeatureMapping {
    mapping: { [featureName: string]: SingleFeatureWithConfig };
    bootstrapFeatures: string[];
    rootFeatureName: string;
}

export interface LinkInfo {
    url: string;
    feature: string;
    config?: string;
}

export interface TestCommand {
    flavor: string;
    env: string;
    watch: boolean;
    debug: boolean;
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

export const isProcessMessage = (value: unknown): value is IProcessMessage<unknown> =>
    typeof value === 'object' && value !== null && typeof (value as IProcessMessage<unknown>).id === 'string';

export const isPortMessage = (value: unknown): value is IProcessMessage<IPortMessage> => {
    return isProcessMessage(value) && value.id === 'port-request';
};

export const isFeatureMessage = (value: unknown): value is IProcessMessage<IFeatureMessagePayload> => {
    return isProcessMessage(value) && value.id === 'feature-initialized';
};

export interface ErrorResponse extends IProcessMessage<string> {
    id: 'error';
}
export interface IFeatureMessagePayload {
    featureName: string;
    configName: string;
}

export interface IPortMessage {
    port: number;
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
    data: StartEnvironmentOptions;
}

export interface RemoteProcess {
    on: (event: 'message', handler: (message: ICommunicationMessage) => unknown) => void;
    postMessage: (message: ICommunicationMessage) => unknown;
    terminate?: () => void;
    off: (event: 'message', handler: (message: ICommunicationMessage) => unknown) => void;
}

export interface IFeatureModule {
    /**
     * Feature name.
     * @example "gui" for "gui.feature.ts"
     */
    name: string;

    /**
     * Absolute path pointing to the feature file.
     */
    filePath: string;

    /**
     * Actual evaluated Feature instance exported from the file.
     */
    exportedFeature: Feature;

    /**
     * Exported environments from module.
     */
    exportedEnvs: IEnvironment[];

    /**
     * If module exports any `processingEnv.use('worker')`,
     * it will be set as `'processing': 'worker'`
     */
    usedContexts: Record<string, string>;
}

export interface IEnvironment {
    type: EnvironmentTypes;
    name: string;
    childEnvName?: string;
}

export const isEnvironmentStartMessage = (message: ICommunicationMessage): message is IEnvironmentStartMessage =>
    message.id === 'start';

export const isEnvironmentCloseMessage = (message: ICommunicationMessage): message is IEnvironmentStartMessage =>
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

export interface IFeatureDefinition extends IFeatureModule {
    contextFilePaths: Record<string, string>;
    envFilePaths: Record<string, string>;
    dependencies: string[];
    scopedName: string;
    resolvedContexts: Record<string, string>;
    isRoot: boolean;
    toJSON(): unknown;
}
export interface StaticConfig {
    route: string;
    directoryPath: string;
}

export interface EngineConfig {
    require?: string[];
    featuresDirectory?: string;
    featureTemplatesFolder?: string;
    featureFolderNameTemplate?: string;
    serveStatic?: StaticConfig[];
}
