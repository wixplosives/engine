import type { IFileSystemSync } from '@file-services/types';
import { isConfigFile, isContextFile, isEnvFile, isFeatureFile, isPreloadFile } from './build-constants';

export interface IFeatureDirectory {
    directoryPath: string;
    features: string[];
    configurations: string[];
    envs: string[];
    contexts: string[];
    preloads: string[];
}

export function loadFeatureDirectory(
    directoryPath: string,
    fs: IFileSystemSync,
    ignoreConfigs = false
): IFeatureDirectory {
    const dir = {
        features: [] as string[],
        envs: [] as string[],
        configurations: [] as string[],
        contexts: [] as string[],
        preloads: [] as string[],
    };
    for (const item of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const name = item.name;
        const path = fs.join(directoryPath, name);
        const type = getFileType(name);
        if (item.isFile() && type && type in dir) {
            dir[type].push(path);
        }
    }
    if (ignoreConfigs) {
        dir.configurations = [];
    }
    return { directoryPath, ...dir };
}

const getFileType = (fileName: string) => {
    if (isFeatureFile(fileName)) return 'features';
    if (isConfigFile(fileName)) return 'configurations';
    if (isEnvFile(fileName)) return 'envs';
    if (isContextFile(fileName)) return 'contexts';
    if (isPreloadFile(fileName)) return 'preloads';
    return undefined;
};
