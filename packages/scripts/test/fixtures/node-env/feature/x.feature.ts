import { COM, Config, Environment, Feature, NodeEnvironment, Service } from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single');
export const serverEnv = new NodeEnvironment('server');

export default new Feature({
    id: 'XTestFeature',
    api: {
        echoService: Service.withType<{ echo: () => string }>()
            .defineEntity(serverEnv)
            .allowRemoteAccess(),
        config: Config.withType<{ value: string }>().defineEntity({ value: 'Hello' }, undefined, serverEnv)
    },
    dependencies: [COM]
});
