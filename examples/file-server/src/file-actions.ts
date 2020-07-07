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
    public async getFileContents(filePath: string): Promise<string> {
        return this.fs.promises.readFile(filePath, 'utf8');
    }
    /**
     * @description function returns directory from a path
     * @param directoryPath path on the local file system
     */
    public async getDirectoryTree(directoryPath: string): Promise<IDirectoryContents> {
        const directory: IDirectoryContents = {};
        const allDirectoryElements = this.fs.readdirSync(directoryPath);
        await Promise.all(
            allDirectoryElements.map(async (elementName) => {
                if (this.fs.lstatSync(this.fs.join(directoryPath, elementName)).isFile()) {
                    directory[elementName] = this.getFileData(this.fs.join(directoryPath, elementName));
                } else {
                    try {
                        directory[elementName] = await this.getDirectoryTree(
                            `${this.fs.join(directoryPath, elementName)}`
                        );
                    } catch {
                        return;
                    }
                }
            })
        );

        return directory;
    }
}
