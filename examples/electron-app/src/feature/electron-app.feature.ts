import { COM, Environment, Feature, Service } from '@wixc3/engine-core';

export const host = new Environment('host', 'electron-main', 'single');
export const renderer = new Environment('renderer', 'electron-renderer', 'single');
export const server = new Environment('server', 'node', 'single');
export const server2 = new Environment('server2', 'node', 'single');

export interface IServerApi {
    echo(): Promise<string>;
    subscribe(cb: (times: number) => void): void;
    invokeListeners(): void;
    getText(): Promise<string>;
}

export default new Feature({
    id: 'electronExample',
    dependencies: [COM],
    api: {
        echoService: Service.withType<IServerApi>()
            .defineEntity(server)
            .allowRemoteAccess({
                subscribe: {
                    emitOnly: true,
                    listener: true,
                },
            }),

        anotherEchoService: Service.withType<IServerApi>()
            .defineEntity(server2)
            .allowRemoteAccess({
                subscribe: {
                    emitOnly: true,
                    listener: true,
                },
            }),
    },
});
