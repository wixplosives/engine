import type { IFileSystemSync } from '@file-services/types';

export function getFilePathInPackage(
    fs: IFileSystemSync,
    packageName: string,
    context: string,
    filePath: string,
    isRelativeRequest: boolean,
) {
    const relativeFilePath = fs.relative(context, filePath);
    const relativeRequest = fs.join(fs.dirname(relativeFilePath), fs.basename(relativeFilePath)).replace(/\\/g, '/');
    return isRelativeRequest
        ? relativeRequest.startsWith('.')
            ? relativeRequest
            : './' + relativeRequest
        : fs.posix.join(packageName, relativeRequest);
}

export function scopeFilePathsToPackage(
    fs: IFileSystemSync,
    packageName: string,
    context: string,
    isRoot: boolean,
    envFiles: Record<string, string> = {},
) {
    return Object.entries(envFiles).reduce<Record<string, string>>((acc, [envName, filePath]) => {
        acc[envName] = getFilePathInPackage(fs, packageName, context, filePath, isRoot);
        return acc;
    }, {});
}
