import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition } from './types';

export interface DefaultConfigFileExports {
    default: TopLevelConfig;
}

export interface FindAllConfigsOptions {
    basePath: string;
    requestedEnvName?: string;
    requestedConfigName: string;
    configurations: SetMultiMap<string, IConfigDefinition | TopLevelConfig>;
    resolveFrom?: typeof defaultResolveFrom;
    importConfig?: typeof defaultImportConfig;
}

export const defaultImportConfig = (filePath: string): TopLevelConfig | Promise<TopLevelConfig> =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require(filePath) as DefaultConfigFileExports).default;

export const defaultResolveFrom = (request: string, from: string): string =>
    require.resolve(request, { paths: [from] });

export async function findAllConfigs({
    basePath,
    requestedEnvName,
    requestedConfigName,
    configurations,
    resolveFrom = defaultResolveFrom,
    importConfig = defaultImportConfig,
}: FindAllConfigsOptions) {
    const config: TopLevelConfig = [];
    const configDefinitions = configurations.get(requestedConfigName);

    if (configDefinitions) {
        for (const configDefinition of configDefinitions) {
            if (Array.isArray(configDefinition)) {
                config.push(...configDefinition);
            } else {
                const { filePath, envName } = configDefinition;
                if (envName === requestedEnvName || !envName) {
                    const resolvedPath = resolveFrom(filePath, basePath);
                    try {
                        config.push(...(await importConfig(resolvedPath)));
                    } catch (e) {
                        console.error(`Failed evaluating config file: ${filePath}`);
                        console.error(e);
                    }
                }
            }
        }
    }

    return config;
}
