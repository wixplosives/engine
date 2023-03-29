import type {
    AnyEnvironment,
    BaseHost,
    Environment,
    EnvironmentTypes,
    MultiEnvironment,
    TopLevelConfig,
} from '@wixc3/engine-core';

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

export interface IEnvironmentDescriptor<ENV extends AnyEnvironment = AnyEnvironment> {
    type: EnvironmentTypes;
    name: string;
    childEnvName?: string;
    flatDependencies?: IEnvironmentDescriptor<MultiEnvironment<ENV['envType']>>[];
    env: ENV;
}

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
