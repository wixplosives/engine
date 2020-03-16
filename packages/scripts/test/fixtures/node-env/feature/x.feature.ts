import {
    COM,
    Config,
    Environment,
    Feature,
    Service,
    windowInitializer,
    socketServerInitializer
} from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single', windowInitializer());
export const serverEnv = new Environment('server', 'node', 'single', socketServerInitializer());

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
