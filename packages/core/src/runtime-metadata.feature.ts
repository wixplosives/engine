import type { INpmPackage } from '@wixc3/resolve-directory-context';
import { Config } from './entities/config';
import { Feature } from './entities/feature';
import type { FeatureEnvDefinition } from './types';

export interface RuntimeMetadataConfig {
    devport?: number;
    applicationPath?: string;
    packages?: INpmPackage[];
    featureName?: string;
    featureEnvDefinitions?: Record<string, FeatureEnvDefinition>;
}

export default new Feature({
    id: 'runtimeMetadata',
    dependencies: [],
    api: {
        config: new Config<RuntimeMetadataConfig>({
            applicationPath: '',
        }),
    },
});
