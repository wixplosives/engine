import { Config } from './entities/config';
import { Feature } from './entities/feature';

export interface FoundFeatures {
    featureName: string;
    configurations: string[];
}

export interface RuntimeMetadataConfig {
    devport?: number;
    applicationPath?: string;
    isWorkspace?: boolean;
    featureName?: string;
    foundFeatures?: FoundFeatures[];
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
