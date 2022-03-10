import { Config } from './entities/config';
import { Feature } from './entities/feature';

export interface FoundFeatures {
    featureName: string;
    configurations: string[];
}

export interface MetadataConfig {
    devport?: number;
    applicationPath?: string;
    featureName?: string;
    foundFeatures?: FoundFeatures[];
    isWorkspace?: boolean;
}

export default new Feature({
    id: 'runtimeMetadata',
    dependencies: [],
    api: {
        runtimeMetadataConfig: new Config<MetadataConfig>({
            applicationPath: '',
        }),
    },
});
