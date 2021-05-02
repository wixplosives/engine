import { Feature, Environment, COM, Config } from '@wixc3/engine-core';
import type { FeatureLoaderMeta, IExtenalFeatureDescriptor } from '@wixc3/engine-scripts';
import buildFeature from './dev-server.feature';

export const mainDashboardEnv = new Environment('main-dashboard', 'window', 'single');

export interface EngineerConfig {
    features: Map<string, FeatureLoaderMeta>;
    externalFeatures: IExtenalFeatureDescriptor[];
}

export default new Feature({
    id: 'dashboard-gui',
    dependencies: [buildFeature, COM],
    api: {
        /**
         * configuration for building and running the dashboard
         */
        engineerConfig: new Config<EngineerConfig>({
            features: new Map<string, FeatureLoaderMeta>(),
            externalFeatures: [],
        }),
    },
});
