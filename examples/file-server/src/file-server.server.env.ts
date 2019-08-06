import { FileActions } from './file-actions';
import FileServer, { FileSystemAPI, server } from './file-server.feature';
import { IDirectoryContents } from './types';

/**
 * implementation of the FileSystemAPI interface
 */
class RemoteFilesAPI implements FileSystemAPI {
    private fileActions: FileActions;
    constructor(basePath: string) {
        this.fileActions = new FileActions(basePath);
    }
    public readDir(directoryPath: string): Promise<IDirectoryContents> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(this.fileActions.getDirectoryTree(directoryPath));
            }, 10_000);
        });
    }

    public async readFile(filePath: string): Promise<string | null> {
        return this.fileActions.getFileContents(filePath);
    }
}

/**
 * setting up the server environment
 */
FileServer.setup(server, ({ fileServerConfig }, {}) => {
    /**
     * exposing the remoteFiles implementation of thje server side
     */
    return {
        remoteFiles: new RemoteFilesAPI(fileServerConfig.defaultDirName)
    };
});
