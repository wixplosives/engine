import { COM, Environment, Feature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');
export interface IEchoService {
    echo(): void;
}

export default class IframeEnvFromScript extends Feature<'iframe-env-from-script'> {
    id = 'iframe-env-from-script' as const;
    api = {
        echoService: Service.withType<IEchoService>().defineEntity(iframeEnv).allowRemoteAccess(),
    };
    dependencies = [COM];
}
