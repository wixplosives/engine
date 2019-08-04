import { COM, Environment, Feature, NodeEnvironment, Service } from '@wixc3/engine-core';

export const mainEnv = new Environment('main');
export const serverEnv = new NodeEnvironment('server');

export default new Feature({
    id: 'XTestFeature',
    api: {
        serverService: Service.withType<{ echo: () => string }>()
            .defineEntity(serverEnv)
            .allowRemoteAccess()
    },
    dependencies: [COM]
});
