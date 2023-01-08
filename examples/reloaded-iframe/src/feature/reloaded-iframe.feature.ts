import { COM, Environment, EngineFeature, Service } from '@wixc3/engine-core';
export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');
export interface IEchoService {
    onEcho(handler: (times: number) => void): void;
    echo(): void;
}

export default class IframeReload extends EngineFeature<'iframeReload'> {
    id = 'iframeReload' as const;
    api = {
        echoService: Service.withType<IEchoService>()
            .defineEntity(iframeEnv)
            .allowRemoteAccess({
                onEcho: {
                    listener: true,
                },
            }),
    };
    dependencies = [COM];
}
