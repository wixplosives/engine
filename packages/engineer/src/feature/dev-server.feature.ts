import type io from 'socket.io';
import type webpack from 'webpack';
import { Feature, Service, Environment, COM, Config, TopLevelConfig, Slot } from '@wixc3/engine-core';
import type { IExternalDefinition, TopLevelConfigProvider, LaunchEnvironmentMode } from '@wixc3/engine-runtime-node';
import type { TargetApplication } from '../application-proxy-service';
import type { Express } from 'express';

export const devServerEnv = new Environment('dev-server', 'node', 'single');

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
    externalFeatureDefinitions: IExternalDefinition[];
    externalFeaturesPath?: string;
    serveExternalFeaturesPath?: boolean;
    featureDiscoveryRoot?: string;
    socketServerOptions?: Partial<io.ServerOptions>;
    webpackConfigPath?: string;
    externalFeaturesRoute: string;
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

export default new Feature({
    id: 'buildFeature',
    dependencies: [COM.asEntity],
    api: {
        /**
         * service providing application level behavior and info, such as node env management, feature detection etc
         */
        application: Service.withType<TargetApplication>().defineEntity(devServerEnv).allowRemoteAccess(),
        /**
         * Dev server configuration, will usually be passed in from the cli params
         */
        devServerConfig: new Config<DevServerConfig>({
            httpServerPort: 3000,
            singleFeature: false,
            inspect: false,
            autoLaunch: true,
            mode: 'development',
            overrideConfig: [],
            defaultRuntimeOptions: {},
            publicConfigsRoute: 'configs/',
            externalFeatureDefinitions: [],
            externalFeaturesRoute: '/external-features.json',
        }),
        /**
         * a slot for registering callback that will be called when the devserver is listening
         */
        serverListeningHandlerSlot: Slot.withType<ServerListeningHandler>().defineEntity(devServerEnv),
        /**
         * A slot from registering webpack configs for different dashboards
         */
        engineerWebpackConfigs: Slot.withType<webpack.Configuration>().defineEntity(devServerEnv),
        /**
         * Actions that can be performed on the dev server, currently only close
         */
        devServerActions: Service.withType<DevServerActions>().defineEntity(devServerEnv),
    },
});
