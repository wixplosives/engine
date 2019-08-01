import { COM, Config, Environment, Feature, NodeEnvironment, Service } from '@wixc3/engine-core';
import { IDirectoryContents } from './types';

/**
 * defining that this feature uses 2 environments - 'main' (browser) and LiveServer environment with the semantic name 'server'
 */
export const main = new Environment('main');
export const server = new NodeEnvironment('server');

/**
 * defining the interface of the file system api which the server will implement
 */
export interface FileSystemAPI {
    readDir(filePath: string): Promise<IDirectoryContents>;
    readFile(filePath: string): Promise<string | null>;
}

/**
 * defining a default config for the ffeature
 */
export const fileServerConfig = new Config<Record<string, string>>({
    defaultDirName: process.cwd()
});

/**
 * exporting new feature that exposes 2 api records
 * 1. remoteFiles - a service that will be implemented in the server environment file and will implement the FileSystemAPI interface, and defining it as 'allow remote access' so that other environments could acces this service
 * 2. fileServerConfig - configuration for this feature
 */
export default new Feature({
    id: 'fileServerExample',
    dependencies: [COM],
    api: {
        remoteFiles: Service.withType<FileSystemAPI>()
            .defineEntity(server)
            .allowRemoteAccess(),
        fileServerConfig
    }
});
