import type { IFileSystem } from '@file-services/types';

const zipFileExtName = '.zip';

const generateFileName = () => Math.random().toString(16).slice(2) + zipFileExtName;

const ensureFileNameContainsZipExt = (filePath: string, ext: string) =>
    ext === zipFileExtName ? filePath : filePath + zipFileExtName;

const ensureTraceName = (fallbackName: string, ext: string) =>
    ensureFileNameContainsZipExt(fallbackName, ext).replace(' ', '_');

export interface EnsureTracePathOptions {
    outPath: string;
    name?: string;
    fs: IFileSystem;
}

export const ensureTracePath = ({ outPath, name, fs }: EnsureTracePathOptions) => {
    if (!fs.existsSync(outPath)) {
        fs.ensureDirectorySync(outPath);
    }

    return fs.join(outPath, name ? ensureTraceName(name, fs.extname(name)) : generateFileName());
};
