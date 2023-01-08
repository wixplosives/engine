import { EngineFeature, Environment, COM, Config } from '@wixc3/engine-core';
import type { IFeatureDefinition } from '@wixc3/engine-scripts';
import buildFeature from './dev-server.feature';

export const mainDashboardEnv = new Environment('main-dashboard', 'window', 'single');

export interface EngineerConfig {
    features: Map<string, IFeatureDefinition>;
}

export default class Dashboard_gui extends EngineFeature<'dashboard-gui'> {
    id = 'dashboard-gui' as const;
    api = {
        /**
         * configuration for building and running the dashboard
         */
        engineerConfig: new Config<EngineerConfig>({
            features: new Map<string, IFeatureDefinition>(),
        }),
    };
    dependencies = [buildFeature, COM];
}
