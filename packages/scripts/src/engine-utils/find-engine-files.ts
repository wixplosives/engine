import { IFileSystemSync } from '@file-services/types';
import { isConfigFile, isContextFile, isEnvFile, isFeatureFile } from '../build-constants';

export interface IFindEngineFilesOptions extends Partial<IFeatureEntityFiles> {
    directoryPath: string;
    fs: IFileSystemSync;

    /**
     * Number of directory levels to iterate into when searching for entity files.
     * @default 0
     */
    depth?: number;
}

export interface IFeatureEntityFiles {
    features: string[];
    configurations: string[];
    envs: string[];
    contexts: string[];
}

export function findEngineFiles(options: IFindEngineFilesOptions): IFeatureEntityFiles {
    const { directoryPath, fs, depth = 0, features = [], configurations = [], envs = [], contexts = [] } = options;
    if (fs.directoryExistsSync(directoryPath)) {
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
            } else if (item.isDirectory() && depth > 0) {
                findEngineFiles({
                    directoryPath: itemPath,
                    depth: depth - 1,
                    fs,
                    configurations,
                    contexts,
                    envs,
                    features
                });
            }
        }
    }

    return { features, envs, configurations, contexts };
}
