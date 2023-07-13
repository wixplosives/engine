import { Config } from './entities/config';
import { Feature } from './entities/feature';
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
export default class RuntimeMetadata extends Feature<'runtimeMetadata'> {
    id = 'runtimeMetadata' as const;
    api = {
        engineerMetadataConfig: new Config<EngineerMetadataConfig>({}),
    };
    dependencies = [];
}
