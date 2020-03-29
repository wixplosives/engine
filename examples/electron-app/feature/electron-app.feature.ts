import { COM, Environment, Feature, Service } from '@wixc3/engine-core';

/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main', 'electron-renderer', 'single');
export const server = new Environment('server', 'node', 'single');
/**
 * defining the interface of the file system api which the server will implement
 */
export interface IServerApi {
    echo(): string;
    listenToTimer(cb: (times: number) => void): void;
}

/**
 * exporting new feature that exposes an api record
 * remoteFiles - a service that will be implemented in the server environment file and will implement the FileSystemAPI interface, and defining it as 'allow remote access' so that other environments could acces this service
 */
export default new Feature({
    id: 'electronExample',
    dependencies: [COM],
    api: {
        echoService: Service.withType<IServerApi>()
            .defineEntity(server)
            .allowRemoteAccess({
                listenToTimer: {
                    emitOnly: true,
                    listener: true
                }
            })
    }
});
