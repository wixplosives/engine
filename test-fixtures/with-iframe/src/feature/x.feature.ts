import { COM, Environment, EngineFeature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'single');

export default class XTestFeature extends EngineFeature<'XTestFeature'> {
    id = 'XTestFeature' as const;
    api = {
        echoService: Service.withType<{
            echo: (message: string) => void;
        }>()
            .defineEntity(iframeEnv)
            .allowRemoteAccess(),
    };
    dependencies = [COM];
}
