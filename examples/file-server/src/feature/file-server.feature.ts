import { COM, Config, Environment, Feature, Service } from '@wixc3/engine-core';
import type { IDirectoryContents } from '../types';

/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main', 'window', 'single');
export const server = new Environment('server', 'node', 'single');

/**
 * defining the interface of the file system api which the server will implement
 */
export interface FileSystemAPI {
    readDir(filePath: string): IDirectoryContents;
    readFile(filePath: string): string;
}

export const MAIN_MARK = 'main';
export const SERVER_MARK = 'server';

/**
 * exporting new feature that exposes an api record
 * remoteFiles - a service that will be implemented in the server environment file and will implement the FileSystemAPI interface, and defining it as 'allow remote access' so that other environments could acces this service
 */
export default new Feature({
    id: 'fileServerExample',
    dependencies: [COM],
    api: {
        remoteFiles: Service.withType<FileSystemAPI>().defineEntity(server).allowRemoteAccess(),
        config: new Config<{ title?: string }>({}),
    },
});
