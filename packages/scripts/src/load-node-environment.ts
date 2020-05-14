import { resolvePackages, loadFeaturesFromPackages, IConfigDefinition } from '@wixc3/engine-scripts';
import { IFileSystem } from '@file-services/types';
import { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';

export async function readFeatures(fs: IFileSystem, basePath: string, featuresDirectory?: string) {
    const packages = resolvePackages(basePath);

    return loadFeaturesFromPackages(packages, fs, featuresDirectory);
}

export function evaluateConfig(
    configName: string,
    configurations: SetMultiMap<string, IConfigDefinition>,
    envName: string
) {
    const config: TopLevelConfig = [];
    const configs = configurations.get(configName);
    if (!configs) {
        throw new Error(`no such config ${configName}`);
    }

    for (const { filePath, envName: configEnvName } of configs) {
        if (!configEnvName || configEnvName === envName) {
            config.push(...require(filePath).default);
        }
    }

    return config;
}
