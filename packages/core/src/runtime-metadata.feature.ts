import { Config } from './entities/config';
import { Feature } from './entities/feature';

export interface RuntimeMetadataConfig {
    devport?: number;
    applicationPath: string;
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
