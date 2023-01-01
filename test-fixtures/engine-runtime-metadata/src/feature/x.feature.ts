import { COM, Environment, Feature, RuntimeMetadata, EngineerMetadataConfig, Service } from '@wixc3/engine-core';

export const client = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'XTestFeature',
    api: {
        runtimeMetadata: Service.withType<{ getEngineerMetadata: () => EngineerMetadataConfig }>()
            .defineEntity(server)
            .allowRemoteAccess(),
    },
    dependencies: [COM, RuntimeMetadata],
});
