import type { IFileSystem } from '@file-services/types';

const zipFileExtName = '.zip';

const generateFileName = () => Math.random().toString(16).slice(2) + zipFileExtName;

const ensureFileNameContainsZipExt = (filePath: string, ext: string) =>
    ext === zipFileExtName ? filePath : filePath + zipFileExtName;

const ensureFallbackName = (fallbackName: string, ext: string) =>
    ensureFileNameContainsZipExt(fallbackName, ext).replace(' ', '_');

export interface EnsureTracePathOptions {
    /**
     * resolved file/directory path to save trace file at
     */
    filePath: string;
    fallbackName?: string;
    fs: IFileSystem;
}

export const ensureTracePath = ({ filePath, fallbackName, fs }: EnsureTracePathOptions) => {
    const filePathExt = fs.extname(filePath);

    const fileDirname = filePathExt ? fs.dirname(filePath) : filePath;

    if (!fs.existsSync(fileDirname)) {
        fs.ensureDirectorySync(fileDirname);
    }

    return filePathExt
        ? ensureFileNameContainsZipExt(filePath, filePathExt)
        : fs.join(
              fileDirname,
              fallbackName ? ensureFallbackName(fallbackName, fs.extname(fallbackName)) : generateFileName()
          );
};
