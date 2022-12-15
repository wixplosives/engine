import type { Express } from 'express';
import type { TopLevelConfigProvider, LaunchEnvironmentMode } from '@wixc3/engine-runtime-node';
import type { TopLevelConfig } from '@wixc3/engine-core';
import type io from 'socket.io';

export interface DevServerConfig {
    httpServerPort: number;
    featureName?: string;
    singleFeature?: boolean;
    configName?: string;
    publicPath?: string;
    title?: string;
    favicon?: string;
    publicConfigsRoute: string;
    inspect: boolean;
    autoLaunch: boolean;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    basePath?: string;
    mode: 'production' | 'development';
    overrideConfig: TopLevelConfig | TopLevelConfigProvider;
    defaultRuntimeOptions: Record<string, string | boolean>;
    outputPath?: string;
    featureDiscoveryRoot?: string;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
    log?: boolean;
}

export interface DevServerActions {
    close: () => Promise<void>;
}

export interface ServerListeningParams {
    port: number;
    host: string;
    router: Express;
}

export type ServerListeningHandler = (params: ServerListeningParams) => void | Promise<void>;
