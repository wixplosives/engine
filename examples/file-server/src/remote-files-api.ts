import fs from '@file-services/node';
import crossPerf from '@wixc3/cross-performance';
import { FileSystemAPI, SERVER_MARK } from './feature/file-server.feature';
import type { FileData, IDirectoryContents } from './types';

export class RemoteFilesAPI implements FileSystemAPI {
    constructor(private basePath: string) {}

    public readDir(directoryPath: string): IDirectoryContents {
        crossPerf.mark(SERVER_MARK);
        return this.getDirectoryTree(fs.join(this.basePath, directoryPath));
    }

    public readFile(filePath: string): string {
        return fs.readFileSync(fs.join(this.basePath, filePath), 'utf8');
    }

    public getDirectoryTree(directoryPath: string): IDirectoryContents {
        const directory: IDirectoryContents = {};
        for (const item of fs.readdirSync(directoryPath, { withFileTypes: true })) {
            const itemPath = fs.join(directoryPath, item.name);
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
            filePath: fs.relative(this.basePath, filePath).replace(/\\/g, '/'),
            fileName: fs.basename(filePath),
        };
    }
}
