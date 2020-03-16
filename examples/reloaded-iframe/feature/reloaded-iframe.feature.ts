import { COM, Environment, Feature, Service, windowInitializer } from '@wixc3/engine-core';
import { iframeInitializer } from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single', windowInitializer());
export const iframeEnv = new Environment('iframe', 'iframe', 'multi', iframeInitializer());
export interface IEchoService {
    onEcho(handler: (times: number) => void): void;
    echo(): void;
}

export default new Feature({
    id: 'iframeReload',
    dependencies: [COM],
    api: {
        echoService: Service.withType<IEchoService>()
            .defineEntity(iframeEnv)
            .allowRemoteAccess()
    }
});
