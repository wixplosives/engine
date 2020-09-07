import { Feature, Service, Environment, COM, Config, TopLevelConfig } from '@wixc3/engine-core/src';
import type { ApplicationProxyService } from '../src/application-proxy-service';
import type { LaunchEnvironmentMode, TopLevelConfigProvider } from '@wixc3/engine-scripts/src';
import { cwd } from 'process';

export const buildEnv = new Environment('build', 'node', 'single');

export interface DevServerConfig {
    httpServerPort?: number;
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

export default new Feature({
    id: 'buildFeature',
    dependencies: [COM],
    api: {
        application: Service.withType<ApplicationProxyService>().defineEntity(buildEnv).allowRemoteAccess(),
        devServerConfig: new Config<DevServerConfig>({
            httpServerPort: 3000,
            singleFeature: false,
            publicConfigsRoute: 'configs/',
            singleRun: false,
            inspect: false,
            autoLaunch: false,
            nodeEnvironmentsMode: 'same-server',
            basePath: cwd(),
            mode: 'development',
            overrideConfig: [],
            defaultRuntimeOptions: {},
        }),
    },
});
