import { Feature, Config } from '@wixc3/engine-core';

export interface RuntimeMetadataConfig {
    devport?: number;
    applicationPath: string;
}

export default new Feature({
    id: 'runtimeMetadata',
    dependencies: [],
    api: {
        config: new Config<RuntimeMetadataConfig>({
            applicationPath: process.cwd(),
        } as RuntimeMetadataConfig),
    },
});
