import {
    Feature,
    Service,
    Environment,
    COM,
    Config,
    TopLevelConfig,
    Slot,
    AsyncApi,
    EnvironmentTypes,
    EnvironmentMode,
    Registry,
    IComConfig,
    EnvVisibility,
    LoggerTransport,
    LoggerService,
    IActiveEnvironment,
    EnvironmentInitializer,
    Communication,
} from '@wixc3/engine-core';
import type { TargetApplication } from '../src/application-proxy-service';
import type { LaunchEnvironmentMode, TopLevelConfigProvider } from '@wixc3/engine-scripts';
import type webpack from 'webpack';

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
}

export interface DevServerActions {
    close: () => Promise<void>;
}

export interface ServerListeningParams {
    port: number;
    host: string;
}

export type ServerListeningHandler = (params: ServerListeningParams) => void | Promise<void>;

const application: Service<
    TargetApplication,
    AsyncApi<TargetApplication>,
    Environment<'dev-server', 'node', 'single'>,
    Environment<string, EnvironmentTypes, EnvironmentMode>,
    true
> = Service.withType<TargetApplication>().defineEntity(devServerEnv).allowRemoteAccess();

const devServerConfig: Config<DevServerConfig, Environment<string, EnvironmentTypes, EnvironmentMode>> = new Config<
    DevServerConfig
>({
    httpServerPort: 3000,
    singleFeature: false,
    singleRun: false,
    inspect: false,
    autoLaunch: true,
    mode: 'development',
    overrideConfig: [],
    defaultRuntimeOptions: {},
    publicConfigsRoute: 'configs/',
});

const serverListeningHandlerSlot: Slot<
    Registry<ServerListeningHandler>,
    Environment<'dev-server', 'node', 'single'>
> = Slot.withType<ServerListeningHandler>().defineEntity(devServerEnv);

const engineerWebpackConfigs: Slot<
    Registry<webpack.Configuration>,
    Environment<'dev-server', 'node', 'single'>
> = Slot.withType<webpack.Configuration>().defineEntity(devServerEnv);

const devServerActions: Service<
    DevServerActions,
    DevServerActions,
    Environment<'dev-server', 'node', 'single'>,
    Environment<'dev-server', 'node', 'single'>,
    false
> = Service.withType<DevServerActions>().defineEntity(devServerEnv);

const feature: Feature<
    'buildFeature',
    Feature<
        'COM',
        any[],
        {
            config: Config<IComConfig, EnvVisibility>;
            loggerTransports: Slot<Registry<LoggerTransport>, Environment<'<Universal>', 'window', 'multi'>>;
            loggerService: Service<
                LoggerService,
                LoggerService,
                Environment<'<Universal>', 'window', 'multi'>,
                Environment<'<Universal>', 'window', 'multi'>,
                false
            >;
            startEnvironment: Service<
                <T extends IActiveEnvironment>(
                    env: Environment<string, EnvironmentTypes, EnvironmentMode>,
                    initializer: EnvironmentInitializer<T>
                ) => Promise<T>,
                <T extends IActiveEnvironment>(
                    env: Environment<string, EnvironmentTypes, EnvironmentMode>,
                    initializer: EnvironmentInitializer<T>
                ) => Promise<T>,
                Environment<string, EnvironmentTypes, EnvironmentMode>,
                Environment<string, EnvironmentTypes, EnvironmentMode>,
                false
            >;
            communication: Service<
                Communication,
                Communication,
                Environment<string, EnvironmentTypes, EnvironmentMode>,
                Environment<string, EnvironmentTypes, EnvironmentMode>,
                false
            >;
        },
        any
    >[],
    {
        application: typeof application;
        devServerConfig: typeof devServerConfig;
        serverListeningHandlerSlot: typeof serverListeningHandlerSlot;
        engineerWebpackConfigs: typeof engineerWebpackConfigs;
        devServerActions: typeof devServerActions;
    },
    any
> = new Feature({
    id: 'buildFeature',
    dependencies: [COM],
    api: {
        /**
         * service providing application level behavior and info, such as node env management, feature detection etc
         */
        application,
        /**
         * Dev server configuration, will usually be passed in from the cli params
         */
        devServerConfig,
        /**
         * a slot for registering callback that will be called when the devserver is listening
         */
        serverListeningHandlerSlot,
        /**
         * A slot from registering webpack configs for different dashboards
         */
        engineerWebpackConfigs,
        /**
         * Actions that can be performed on the dev server, currently only close
         */
        devServerActions,
    },
});

feature;

export default feature;
