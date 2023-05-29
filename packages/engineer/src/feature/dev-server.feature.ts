import type webpack from 'webpack';
import { Feature, Service, Environment, COM, Config, Slot } from '@wixc3/engine-core';
import type { DevServerActions, DevServerConfig, ServerListeningHandler } from './dev-server.types';
import { Application } from '@wixc3/engine-scripts';

export const devServerEnv = new Environment('dev-server', 'node', 'single');
export default class BuildFeature extends Feature<'buildFeature'> {
    id = 'buildFeature' as const;
    api = {
        /**
         * service providing application level behavior and info, such as node env management, feature detection etc
         */
        application: Service.withType<Application>().defineEntity(devServerEnv).allowRemoteAccess(),
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
