import type { TopLevelConfig } from '@wixc3/engine-core';
import type { SetMultiMap } from '@wixc3/common';
import type {
    IConfigDefinition,
    IExternalDefinition,
    LaunchEnvironmentMode,
    TopLevelConfigProvider,
} from '@wixc3/engine-runtime-node';
import type io from 'socket.io';
import type webpack from 'webpack';
import type { IFeatureDefinition, IFeatureTarget } from '../types';
import type { getResolvedEnvironments } from '../utils/environments';

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunApplicationOptions extends IFeatureTarget {
    singleFeature?: boolean;
    inspect?: boolean;
    port?: number;
    publicPath?: string;
    mode?: 'development' | 'production';
    title?: string;
    publicConfigsRoute?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    autoLaunch?: boolean;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
}

export interface IBuildCommandOptions extends IRunApplicationOptions {
    featureDiscoveryRoot?: string;
    external?: boolean;
    staticBuild?: boolean;
    externalFeaturesFilePath?: string;
    sourcesRoot?: string;
    staticExternalFeaturesFileName?: string;
    includeExternalFeatures?: boolean;
    eagerEntrypoint?: boolean;
    favicon?: string;
    externalFeaturesBasePath?: string;
    externalFeatureDefinitions?: IExternalDefinition[];
    configLoaderModuleName?: string;
}

// inlined to stay type-compatible with @types/webpack
export interface WebpackMultiStats {
    hasWarnings(): boolean;
    hasErrors(): boolean;
    toString(mode?: string): string;
    stats: webpack.Stats[];
}

export interface IRunCommandOptions extends IRunApplicationOptions {
    serveExternalFeaturesPath?: boolean;
    externalFeaturesPath?: string;
    externalFeatureDefinitions?: IExternalDefinition[];
}

export interface IBuildManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
    entryPoints: Record<string, Record<string, string>>;
    externalsFilePath?: string;
}

export interface ICreateOptions {
    featureName?: string;
    templatesDir?: string;
    featuresDir?: string;
}

export interface IApplicationOptions {
    basePath?: string;
    outputPath?: string;
}

export interface ICompilerOptions {
    features: Map<string, IFeatureDefinition>;
    featureName?: string;
    configName?: string;
    publicPath?: string;
    mode?: 'production' | 'development';
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    singleFeature?: boolean;
    isExternal: boolean;
    externalFeaturesRoute: string;
    webpackConfigPath?: string;
    environments: Pick<ReturnType<typeof getResolvedEnvironments>, 'electronRendererEnvs' | 'workerEnvs' | 'webEnvs'>;
    eagerEntrypoint?: boolean;
    configLoaderModuleName?: string;
}
