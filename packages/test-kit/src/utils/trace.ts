import type { IFileSystem } from '@file-services/types';

export const TRACE_FILE_EXT = '.zip';

export interface EnsureTracePathOptions {
    outPath: string;
    name?: string;
    fs: IFileSystem;
}

export const ensureTracePath = ({ outPath, name, fs }: EnsureTracePathOptions) => {
    if (!fs.existsSync(outPath)) {
        fs.ensureDirectorySync(outPath);
    }

    return fs.join(
        outPath,
        name
            ? fs.extname(name) === TRACE_FILE_EXT
                ? name
                : name + TRACE_FILE_EXT
            : Math.random().toString(16).slice(2) + TRACE_FILE_EXT,
    );
};
