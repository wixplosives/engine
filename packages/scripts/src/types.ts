import { AsyncEnvironment, EnvironmentContext, IComConfig, SomeFeature } from '@wixc3/engine-core';

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

export interface IFeatureMessage {
    id: number;
}

export interface IPortMessage {
    port: number;
}

export interface ServerEnvironmentOptions {
    environment: EngineEnvironmentEntry;
    featureMapping: FeatureMapping;
    featureName: string | undefined;
    configName: string | undefined;
    projectPath: string;
    serverPort: number;
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
    data: ServerEnvironmentOptions;
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

export const isEnvironmentStartMessage = (message: ICommunicationMessage): message is IEnvironmaneStartMessage =>
    message.id === 'start';

export const isEnvironmentCloseMessage = (message: ICommunicationMessage): message is IEnvironmaneStartMessage =>
    message.id === 'close';

export const isPortMessage = (message: ICommunicationMessage): message is IEnvironmentPortMessage =>
    message.id === 'port';

export const isEnvironmentStartStaticMessage = (
    message: ICommunicationMessage
): message is IEnvironmentStartStaticMessage => message.id === 'start-static';
