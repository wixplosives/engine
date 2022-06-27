import { createDirectoryFs } from '@file-services/directory';
import nodeFs from '@file-services/node';
import type { IFileSystem } from '@file-services/types';
import type { FileData, IDirectoryContents } from './types';

/**
 * Class that uses nodeFs to list files and read file data for each file
 */
export class FileActions {
    private fs: IFileSystem;

    constructor(basePath: string, fs: IFileSystem = nodeFs) {
        this.fs = createDirectoryFs(fs, basePath);
    }

    /**
     * will return the relative path of the file and the name of the file
     * @param filePath path to the file in the local file system
     */
    public getFileData(filePath: string): FileData {
        return {
            filePath,
            fileName: this.fs.basename(filePath),
        };
    }

    /**
     * will return the file contents given an absolute file path
     * @param filePath path to the file in the local file system
     */
    public getFileContents(filePath: string): string {
        return this.fs.readFileSync(filePath, 'utf8');
    }

    /**
     * @description function returns directory from a path
     * @param directoryPath path on the local file system
     */
    public getDirectoryTree(directoryPath: string): IDirectoryContents {
        const directory: IDirectoryContents = {};
        for (const item of this.fs.readdirSync(directoryPath, { withFileTypes: true })) {
            if (item.isFile()) {
                directory[item.name] = this.getFileData(this.fs.join(directoryPath, item.name));
            } else if (item.isDirectory()) {
                directory[item.name] = this.getDirectoryTree(this.fs.join(directoryPath, item.name));
            }
        }
        return directory;
    }
}
