import { Environment, Feature, RuntimeMetadata, MetadataConfig } from '@wixc3/engine-core';
import { COM, Service } from '@wixc3/engine-com';

export const client = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'XTestFeature',
    api: {
        runtimeMetadata: Service.withType<{ getEngineerMetadata: () => MetadataConfig }>()
            .defineEntity(server)
            .allowRemoteAccess(),
    },
    dependencies: [COM, RuntimeMetadata],
});
