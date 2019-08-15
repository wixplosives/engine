import { FileActions } from '../src/file-actions';
import { IDirectoryContents } from '../src/types';
import FileServer, { FileSystemAPI, server } from './file-server.feature';

/**
 * implementation of the FileSystemAPI interface
 */
class RemoteFilesAPI implements FileSystemAPI {
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
