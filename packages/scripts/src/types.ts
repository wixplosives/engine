import {
    AsyncEnvironment,
    EnvironmentContext,
    EnvironmentTypes,
    IComConfig,
    SomeFeature,
    TopLevelConfig
} from '@wixc3/engine-core';

/**
 * Use to init socket server that share the environment state between all connections
 */
export type IRunNodeEnvironmentsOptions = IEnvironment & {
    featureName: string;
    config?: TopLevelConfig;
    features: Record<string, IFeatureDefinition>;
    httpServerPath: string;
    projectPath?: string;
};

export type JSRuntime = 'web' | 'webworker' | 'node';

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

export interface EngineEnvironmentSerializableEntry {
    name: string;
    target: JSRuntime;
    isRoot: boolean;
    envFiles: string[];
    featureMapping: FeatureMapping;
    entryFilename: string;
    contextFiles?: string[];
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
    features: SymbolList<SomeFeature>;
    environments: SymbolList<AsyncEnvironment>;
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
    | 'port';

export interface IProcessMessage<T> {
    id: ProcessMessageId;
    payload: T;
}

export const isProcessMessage = (value: unknown): value is IProcessMessage<unknown> =>
    typeof value === 'object' && value !== null && typeof (value as IProcessMessage<unknown>).id === 'string';

export const isPortMessage = (value: unknown): value is IProcessMessage<IPortMessage> => {
    return isProcessMessage(value) && value.id === 'port';
};

export const isFeatureMessage = (value: unknown): value is IProcessMessage<IFeatureMessage> => {
    return isProcessMessage(value) && value.id === 'feature-initialized';
};
export interface IFeatureMessage {
    featureName: string;
    configName?: string;
}

export interface IPortMessage {
    port: number;
}

export interface ServerEnvironmentOptions {
    environment: IEnvironment;
    features: Map<string, IFeatureDefinition>;
    featureName: string;
    config: TopLevelConfig;
    projectPath: string;
    httpServerPath: string;
}

export type IEnvironmentMessageID = 'start' | 'close' | 'port' | 'start-static';

export interface ICommunicationMessage {
    id: IEnvironmentMessageID;
}

export interface IEnvironmentPortMessage extends ICommunicationMessage {
    id: 'port';
    port: number;
}

export interface IEnvironmentMessage extends ICommunicationMessage {
    id: 'start' | 'start-static' | 'close';
    envName: string;
}

export interface IEnvironmaneStartMessage extends IEnvironmentMessage {
    id: 'start';
    data: IRunNodeEnvironmentsOptions;
}

export interface IEnvironmentStartStaticMessage extends IEnvironmentMessage {
    id: 'start-static';
    envName: string;
    entityPath: string;
    serverConfig: Array<Partial<IComConfig>>;
}

export interface RemoteProcess {
    on: (event: 'message', handler: (message: ICommunicationMessage) => unknown) => void;
    postMessage: (message: ICommunicationMessage) => unknown;
    terminate?: () => void;
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
    exportedFeature: SomeFeature;

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

export interface IConfigDefinition {
    name: string;
    filePath: string;
    envName?: string;
}

export interface IFeatureDefinition extends IFeatureModule {
    contextFilePaths: Record<string, string>;
    envFilePaths: Record<string, string>;
    dependencies: string[];
    scopedName: string;
    resolvedContexts: Record<string, string>;
    isRoot: boolean;
}

export const isEnvironmentStartMessage = (message: ICommunicationMessage): message is IEnvironmaneStartMessage =>
    message.id === 'start';

export const isEnvironmentCloseMessage = (message: ICommunicationMessage): message is IEnvironmaneStartMessage =>
    message.id === 'close';

export const isEnvironmentPortMessage = (message: ICommunicationMessage): message is IEnvironmentPortMessage =>
    message.id === 'port';

export const isEnvironmentStartStaticMessage = (
    message: ICommunicationMessage
): message is IEnvironmentStartStaticMessage => message.id === 'start-static';
