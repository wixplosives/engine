import { Config } from './entities/config';
import { EngineFeature } from './entities/feature-descriptor';
export interface FoundFeatures {
    featureName: string;
    configurations: string[];
}
export interface EngineerMetadataConfig {
    devport?: number;
    applicationPath?: string;
    featureName?: string;
    foundFeatures?: FoundFeatures[];
    isWorkspace?: boolean;
}
export default class RuntimeMetadata extends EngineFeature<'runtimeMetadata'> {
    id = 'runtimeMetadata' as const;
    api = {
        engineerMetadataConfig: new Config<EngineerMetadataConfig>({
            applicationPath: '',
        }),
    };
    dependencies = [];
}
