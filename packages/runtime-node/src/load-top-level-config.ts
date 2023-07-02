import type { SetMultiMap } from '@wixc3/patterns';
import type { TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition } from './types';

export async function loadTopLevelConfigs(
    configName: string | undefined,
    configurations?: SetMultiMap<string, IConfigDefinition | TopLevelConfig>,
    envName?: string
) {
    const config: TopLevelConfig = [];
    if (configurations && configName) {
        const configs = configurations.get(configName);
        if (!configs) {
            const configNames = Array.from(configurations.keys());
            throw new Error(`cannot find config "${configName}". available configurations: ${configNames.join(', ')}`);
        }
        for (const definition of configs) {
            try {
                // top level config
                if (Array.isArray(definition)) {
                    config.push(...definition);
                } else {
                    // config file
                    if (envName) {
                        if (!definition.envName || definition.envName === envName) {
                            config.push(
                                ...((await import(definition.filePath)) as { default: TopLevelConfig }).default
                            );
                        }
                    } else {
                        config.push(...((await import(definition.filePath)) as { default: TopLevelConfig }).default);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }
    }
    return config;
}
