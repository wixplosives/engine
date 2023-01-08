import { COM, Environment, EngineFeature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');

export default class EchoFeature extends EngineFeature<'echoFeature'> {
    id = 'echoFeature' as const;
    api = {
        echoService: Service.withType<{
            echo: (message: string) => void;
        }>()
            .defineEntity(iframeEnv)
            .allowRemoteAccess(),
    };
    dependencies = [COM];
}
