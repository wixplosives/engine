import type webpack from 'webpack';
import { Feature, Service, Environment, COM, Config, TopLevelConfig, Slot } from '@wixc3/engine-core';
import type { LaunchEnvironmentMode, TopLevelConfigProvider } from '@wixc3/engine-scripts';
import type { TargetApplication } from '../application-proxy-service';

export const devServerEnv = new Environment('dev-server', 'node', 'single');

export interface DevServerConfig {
    httpServerPort: number;
    featureName?: string;
    singleFeature?: boolean;
    configName?: string;
    publicPath?: string;
    title?: string;
    publicConfigsRoute: string;
    singleRun: boolean;
    inspect: boolean;
    autoLaunch: boolean;
    nodeEnvironmentsMode?: LaunchEnvironmentMode;
    basePath?: string;
    mode: 'production' | 'development';
    overrideConfig: TopLevelConfig | TopLevelConfigProvider;
    defaultRuntimeOptions: Record<string, string | boolean>;
    outputPath?: string;
    plugins: string[];
}

export interface DevServerActions {
    close: () => Promise<void>;
}

export interface ServerListeningParams {
    port: number;
    host: string;
}

export type ServerListeningHandler = (params: ServerListeningParams) => void | Promise<void>;

export default new Feature({
    id: 'buildFeature',
    dependencies: [COM],
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
            singleRun: false,
            inspect: false,
            autoLaunch: true,
            mode: 'development',
            overrideConfig: [],
            defaultRuntimeOptions: {},
            publicConfigsRoute: 'configs/',
            plugins: [],
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
