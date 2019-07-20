import { createDirectoryFs } from '@file-services/directory';
import fs from '@file-services/node';
import { FileData, IDirectoryContents } from './types';

const nodeFs = createDirectoryFs(fs, fs.cwd());

/**
 * Class that uses nodeFs to list files and read file data for each file
 */
export class FileActions {
    /**
     * @description function returns directory from a path
     * @param directoryPath path on the local file system
     */
    public static async getDirectoryTree(directoryPath: string): Promise<IDirectoryContents> {
        const directory: IDirectoryContents = {};
        const allDirectoryElements = nodeFs.readdirSync(directoryPath);
        await Promise.all(
            allDirectoryElements.map(async elementName => {
                if (nodeFs.lstatSync(nodeFs.join(directoryPath, elementName)).isFile()) {
                    directory[elementName] = FileActions.getFileData(nodeFs.join(directoryPath, elementName));
                } else {
                    directory[elementName] = await this.getDirectoryTree(`${nodeFs.join(directoryPath, elementName)}`);
                }
            })
        );

        return directory;
    }

    /**
     * will return the relative path of the file and the name of the file
     * @param filePath path to the file in the local file system
     */
    public static getFileData(filePath: string): FileData {
        return {
            filePath,
            fileName: nodeFs.basename(filePath)
        };
    }

    /**
     * will return the file contents given an absolute file path
     * @param filePath path to the file in the local file system
     */
    public static async getFileContents(filePath: string): Promise<string | null> {
        return await nodeFs.promises.readFile(filePath, 'utf8');
    }
}
