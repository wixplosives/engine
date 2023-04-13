import { COM, Config, Environment, Feature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const serverEnv = new Environment('server', 'node', 'single');
export const anotherServerEnv = new Environment('server-two', 'node', 'single');

export default new Feature({
    id: 'XTestFeature',
    api: {
        echoService: Service.withType<{ echo: () => Promise<string>; getName: () => string }>()
            .defineEntity(serverEnv)
            .allowRemoteAccess(),
        anotherEchoService: Service.withType<{ echo: (input?: string | undefined) => Promise<string> }>()
            .defineEntity(anotherServerEnv)
            .allowRemoteAccess(),
        config: Config.withType<{ value: string }>().defineEntity({ value: 'Hello' }, undefined, serverEnv),
    },
    dependencies: [COM.asDependency],
});
