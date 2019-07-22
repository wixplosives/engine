import { FileActions } from './file-actions';
import FileServer, { FileSystemAPI, server } from './file-server.feature';
import { IDirectoryContents } from './types';

/**
 * implementation of the FileSystemAPI interface
 */
class RemoteFilesAPI implements FileSystemAPI {
    public async readDir(directoryPath: string): Promise<IDirectoryContents> {
        return FileActions.getDirectoryTree(directoryPath);
    }

    public async readFile(filePath: string): Promise<string | null> {
        return FileActions.getFileContents(filePath);
    }
}

/**
 * setting up the server environment
 */
FileServer.setup(server, ({}, {}) => {
    /**
     * exposing the remoteFiles implementation of thje server side
     */
    return {
        remoteFiles: new RemoteFilesAPI()
    };
});
