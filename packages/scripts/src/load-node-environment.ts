import type { IFileSystem } from '@file-services/types';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { loadFeaturesFromPackages } from './analyze-feature';
import type { IConfigDefinition } from './types';
import { resolvePackages } from './utils/resolve-packages';

export function readFeatures(fs: IFileSystem, basePath: string, featureDiscoveryRoot?: string) {
    const packages = resolvePackages(basePath);

    return loadFeaturesFromPackages(packages, fs, featureDiscoveryRoot);
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
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            config.push(...(require(filePath) as { default: TopLevelConfig }).default);
        }
    }

    return config;
}
