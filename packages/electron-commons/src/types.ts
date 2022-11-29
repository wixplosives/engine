import type { Environment, TopLevelConfig } from '@wixc3/engine-core';
import type { IEnvironmentDescriptor, StartEnvironmentOptions } from '@wixc3/engine-runtime-node';

export interface IWindowLaunchOptions {
    devtools?: boolean;
    devport?: number;
}

export interface IEngineRuntimeArguments {
    featureName: string;
    basePath: string;
    outputPath: string;
    configName?: string;
    devport?: number;
    nodeEntryPath: string;
    features: [featureName: string, featureDefinition: Required<IStaticFeatureDefinition>][];
    config: TopLevelConfig;
    requiredModules?: string[];
    runtimeOptions?: StartEnvironmentOptions['options'];
}

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

export type INodeEnvStartupMessage = {
    id: 'nodeStartupOptions';
    runOptions: NodeEnvironmentStartupOptions;
};

export const isNodeEnvStartupMessage = (value: unknown): value is INodeEnvStartupMessage => {
    return (value as INodeEnvStartupMessage).id === 'nodeStartupOptions';
};

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

export interface IExtenalFeatureDescriptor {
    envEntries: Record<string, Record<string, string>>;
    packageBasePath: string;
}

export interface MetadataCollectionAPI {
    getRuntimeArguments: () => IEngineRuntimeArguments;
}

export const metadataApiToken = {
    id: 'metadata-api-token',
};
