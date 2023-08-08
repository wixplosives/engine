import { COM, Config, Environment, Feature, Service } from '@wixc3/engine-core';
import type { IDirectoryContents } from '../types.js';

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

export default class FileServerExample extends Feature<'fileServerExample'> {
    id = 'fileServerExample' as const;
    api = {
        remoteFiles: Service.withType<FileSystemAPI>().defineEntity(server).allowRemoteAccess(),
        config: new Config<{
            title?: string;
        }>({}),
    };
    dependencies = [COM];
}
