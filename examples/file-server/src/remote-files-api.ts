import { FileSystemAPI, SERVER_MARK } from '../feature/file-server.feature';
import type { IDirectoryContents } from './types';
import { FileActions } from './file-actions';
import performance from '@wixc3/cross-performance';

export class RemoteFilesAPI implements FileSystemAPI {
    private fileActions: FileActions;
    constructor(basePath: string) {
        this.fileActions = new FileActions(basePath);
    }
    public async readDir(directoryPath: string): Promise<IDirectoryContents> {
        performance.mark(SERVER_MARK);
        return this.fileActions.getDirectoryTree(directoryPath);
    }

    public async readFile(filePath: string): Promise<string> {
        return this.fileActions.getFileContents(filePath);
    }
}
