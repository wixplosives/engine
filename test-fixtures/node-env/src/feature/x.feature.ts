import { COM, Config, Environment, EngineFeature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const serverEnv = new Environment('server', 'node', 'single');

export default class XTestFeature extends EngineFeature<'XTestFeature'> {
    id = 'XTestFeature' as const;
    api = {
        echoService: Service.withType<{
            echo: () => string;
        }>()
            .defineEntity(serverEnv)
            .allowRemoteAccess(),
        config: Config.withType<{
            value: string;
        }>().defineEntity({ value: 'Hello' }, undefined, serverEnv),
    };
    dependencies = [COM];
}
