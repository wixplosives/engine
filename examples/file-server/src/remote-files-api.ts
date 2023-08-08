import fs from 'node:fs';
import path from 'node:path';
import { SERVER_MARK, type FileSystemAPI } from './feature/file-server.feature.js';
import type { FileData, IDirectoryContents } from './types.js';

export class RemoteFilesAPI implements FileSystemAPI {
    constructor(private basePath: string) {}

    public readDir(directoryPath: string): IDirectoryContents {
        performance.mark(SERVER_MARK);
        return this.getDirectoryTree(path.join(this.basePath, directoryPath));
    }

    public readFile(filePath: string): string {
        return fs.readFileSync(path.join(this.basePath, filePath), 'utf8');
    }

    public getDirectoryTree(directoryPath: string): IDirectoryContents {
        const directory: IDirectoryContents = {};
        for (const item of fs.readdirSync(directoryPath, { withFileTypes: true })) {
            const itemPath = path.join(directoryPath, item.name);
            if (item.isFile()) {
                directory[item.name] = this.getFileData(itemPath);
            } else if (item.isDirectory()) {
                directory[item.name] = this.getDirectoryTree(itemPath);
            }
        }
        return directory;
    }

    public getFileData(filePath: string): FileData {
        return {
            filePath: path.relative(this.basePath, filePath).replace(/\\/g, '/'),
            fileName: path.basename(filePath),
        };
    }
}
