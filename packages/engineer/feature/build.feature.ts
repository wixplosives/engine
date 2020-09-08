import { Feature, Service, Environment, COM, Config, TopLevelConfig, Slot } from '@wixc3/engine-core/src';
import type { ApplicationProxyService } from '../src/application-proxy-service';
import type { NodeEnvironmentsManager } from '@wixc3/engine-scripts/src';
import { cwd } from 'process';
import type webpack from 'webpack';

export const buildEnv = new Environment('build', 'node', 'single');

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
    nodeEnvironmentsMode: LaunchEnvironmentMode;
    basePath: string;
    mode: 'production' | 'development';
    overrideConfig: TopLevelConfig | TopLevelConfigProvider;
    defaultRuntimeOptions: Record<string, string | boolean>;
}

export interface BuildHooks {
    serverReady?: () => Promise<void>;
}

export default new Feature({
    id: 'buildFeature',
    dependencies: [COM],
    api: {
        application: Service.withType<ApplicationProxyService>().defineEntity(buildEnv).allowRemoteAccess(),
        devServerConfig: new Config<DevServerConfig>({
            httpServerPort: 3000,
            singleFeature: false,
            singleRun: false,
            inspect: false,
            autoLaunch: false,
            nodeEnvironmentsMode: 'same-server',
            basePath: cwd(),
            mode: 'development',
            overrideConfig: [],
            defaultRuntimeOptions: {},
            publicConfigsRoute: 'configs/',
        }),
        buildHooksSlot: Slot.withType<() => Promise<void>>().defineEntity(buildEnv),
        engineerWebpackConfigs: Slot.withType<webpack.Configuration>().defineEntity(buildEnv),
        nodeEnvironmentManager: Service.withType<NodeEnvironmentsManager>().defineEntity(buildEnv),
    },
});
