import { COM, Environment, Feature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');

export default new Feature({
    id: 'echoFeature',
    api: {
        echoService: Service.withType<{ echo: (message: string) => void }>()
            .defineEntity(iframeEnv)
            .allowRemoteAccess(),
    },
    dependencies: [COM],
});
