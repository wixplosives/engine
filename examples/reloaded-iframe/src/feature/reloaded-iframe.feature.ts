import { COM, Environment, Feature, Service } from '@wixc3/engine-core';

export const mainEnv = new Environment('main', 'window', 'single');
export const iframeEnv = new Environment('iframe', 'iframe', 'multi');
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
            .allowRemoteAccess({
                onEcho: {
                    listener: true,
                },
            }),
    },
});
