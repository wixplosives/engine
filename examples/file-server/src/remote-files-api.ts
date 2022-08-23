import performance from '@wixc3/cross-performance';
import { FileSystemAPI, SERVER_MARK } from './feature/file-server.feature';
import type { IDirectoryContents } from './types';
import { FileActions } from './file-actions';

export class RemoteFilesAPI implements FileSystemAPI {
    private fileActions: FileActions;

    constructor(basePath: string) {
        this.fileActions = new FileActions(basePath);
    }

    public readDir(directoryPath: string): IDirectoryContents {
        performance.mark(SERVER_MARK);
        return this.fileActions.getDirectoryTree(directoryPath);
    }

    public readFile(filePath: string): string {
        return this.fileActions.getFileContents(filePath);
    }
}
