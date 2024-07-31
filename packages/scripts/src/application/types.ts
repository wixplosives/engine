import type { TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition, LaunchEnvironmentMode, TopLevelConfigProvider } from '@wixc3/engine-runtime-node';
import type { SetMultiMap } from '@wixc3/patterns';
import type io from 'socket.io';
import type webpack from 'webpack';
import type { IFeatureDefinition, IFeatureTarget } from '../types.js';
import type { getResolvedEnvironments } from '../utils/environments.js';

export interface IRunFeatureOptions extends IFeatureTarget {
    featureName: string;
}

export interface IRunApplicationOptions extends IFeatureTarget {
    singleFeature?: boolean;
    inspect?: boolean;
    port?: number;
    publicPath?: string;
    publicPathVariableName?: string;
    mode?: 'development' | 'production';
    title?: string;
    publicConfigsRoute?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    autoLaunch?: boolean;
    socketServerOptions?: Partial<io.ServerOptions>;
}

export interface IBuildCommandOptions extends IRunApplicationOptions {
    featureDiscoveryRoot?: string;
    staticBuild?: boolean;
    sourcesRoot?: string;
    eagerEntrypoint?: boolean;
    favicon?: string;
    configLoaderModuleName?: string;
    engineConfigPath?: string;
    webpackConfigPath?: string;
}

// inlined to stay type-compatible with @types/webpack
export interface WebpackMultiStats {
    hasWarnings(): boolean;
    hasErrors(): boolean;
    toString(mode?: string): string;
    stats: webpack.Stats[];
}

export interface IBuildManifest {
    features: Array<[string, IFeatureDefinition]>;
    defaultFeatureName?: string;
    defaultConfigName?: string;
    entryPoints: Record<string, Record<string, string>>;
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
    publicPathVariableName?: string;
    mode?: 'production' | 'development';
    title?: string;
    favicon?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    publicConfigsRoute?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    singleFeature?: boolean;
    webpackConfigPath?: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    eagerEntrypoint?: boolean;
    configLoaderModuleName?: string;
}
