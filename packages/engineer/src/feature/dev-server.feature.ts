import type webpack from 'webpack';
import { EngineFeature, Service, Environment, COM, Config, Slot } from '@wixc3/engine-core';
import type { TargetApplication } from '../application-proxy-service';
import type { DevServerActions, DevServerConfig, ServerListeningHandler } from './dev-server.types';

export const devServerEnv = new Environment('dev-server', 'node', 'single');
export default class BuildFeature extends EngineFeature<'buildFeature'> {
    id = 'buildFeature' as const;
    api = {
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
    };
    dependencies = [COM];
}
