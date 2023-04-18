import { COM, Environment, Feature, Service } from '@wixc3/engine-core';

export const serverEnv = new Environment('server', 'node', 'single');

export default new Feature({
    id: 'DefaultArgsEcho',
    api: {
        echoService: Service.withType<{ echo: (s?: string) => string }>().defineEntity(serverEnv).allowRemoteAccess(),
    },
    dependencies: [COM.asDependency],
});
