import type { TopLevelConfig } from "@wixc3/engine-core";
import type { TopLevelConfigProvider, IExternalDefinition, LaunchEnvironmentMode } from "@wixc3/engine-runtime-node";
import type { EngineConfig } from "@wixc3/engine-scripts";
import type io from 'socket.io';

export interface IStartOptions {
    publicPath?: string;
    targetApplicationPath: string;
    outputPath?: string;
    featureName?: string;
    configName?: string;
    httpServerPort?: number;
    singleFeature?: boolean;
    pathsToRequire?: string[];
    mode?: 'development' | 'production';
    title?: string;
    favicon?: string;
    publicConfigsRoute?: string;
    autoLaunch?: boolean;
    engineerEntry?: string;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    inspect?: boolean;
    runtimeOptions?: Record<string, string | boolean>;
    externalFeatureDefinitions?: IExternalDefinition[];
    externalFeaturesPath?: string;
    featureDiscoveryRoot?: string;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
    log?: boolean;
    minimal?:boolean;
}

export const defaultOptions = {
    httpServerPort: 3000,
    pathsToRequire: [],
    publicPath: '/',
    mode: 'development',
    publicConfigsRoute: 'configs/',
    autoLaunch: true,
    engineerEntry: 'engineer/dev-server',
    overrideConfig: [],
    runtimeOptions: {},
    externalFeatureDefinitions: [],
    minimal: true
}
export type DStartOptions = IStartOptions & typeof defaultOptions;

export const defaultsEngineConfig = {
    externalFeatureDefinitions: [],
    require: [],
}
export type DEngineConfig = EngineConfig & typeof defaultsEngineConfig
