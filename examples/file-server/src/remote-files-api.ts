import { FileSystemAPI } from '../feature/file-server.feature';
import { IDirectoryContents } from './types';
import { FileActions } from './file-actions';

export class RemoteFilesAPI implements FileSystemAPI {
    private fileActions: FileActions;
    constructor(basePath: string) {
        this.fileActions = new FileActions(basePath);
    }
    public async readDir(directoryPath: string): Promise<IDirectoryContents> {
        return this.fileActions.getDirectoryTree(directoryPath);
    }

    public async readFile(filePath: string): Promise<string | null> {
        return this.fileActions.getFileContents(filePath);
    }
}
