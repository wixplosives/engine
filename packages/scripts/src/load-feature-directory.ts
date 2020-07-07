import type { IFileSystemSync } from '@file-services/types';
import { isConfigFile, isContextFile, isEnvFile, isFeatureFile } from './build-constants';

export interface IFeatureDirectory {
    directoryPath: string;
    features: string[];
    configurations: string[];
    envs: string[];
    contexts: string[];
}

export interface ILoadFeatureDirectoryOptions {
    directoryPath: string;
    fs: IFileSystemSync;
}

export function loadFeatureDirectory({ fs, directoryPath }: ILoadFeatureDirectoryOptions): IFeatureDirectory {
    const features: string[] = [];
    const configurations: string[] = [];
    const envs: string[] = [];
    const contexts: string[] = [];
    for (const item of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const itemName = item.name;
        const itemPath = fs.join(directoryPath, itemName);
        if (item.isFile()) {
            if (isFeatureFile(itemName)) {
                features.push(itemPath);
            } else if (isConfigFile(itemName)) {
                configurations.push(itemPath);
            } else if (isEnvFile(itemName)) {
                envs.push(itemPath);
            } else if (isContextFile(itemName)) {
                contexts.push(itemPath);
            }
        }
    }
    return { directoryPath, features, envs, configurations, contexts };
}
