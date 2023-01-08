import { COM, Environment, EngineFeature, RuntimeMetadata, EngineerMetadataConfig, Service } from '@wixc3/engine-core';

export const client = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');

export default class XTestFeature extends EngineFeature<'XTestFeature'> {
    id = 'XTestFeature' as const;
    api = {
        runtimeMetadata: Service.withType<{
            getEngineerMetadata: () => EngineerMetadataConfig;
        }>()
            .defineEntity(server)
            .allowRemoteAccess(),
    };
    dependencies = [COM, RuntimeMetadata];
}
