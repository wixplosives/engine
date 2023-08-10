import type { SetMultiMap } from '@wixc3/patterns';
import type { ConfigModule, TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';

export async function evaluateConfig(
    configName: string,
    configurations: SetMultiMap<string, IConfigDefinition>,
    envName: string,
) {
    const config: TopLevelConfig = [];
    const configs = configurations.get(configName);
    if (!configs) {
        throw new Error(`no such config ${configName}`);
    }

    for (const { filePath, envName: configEnvName } of configs) {
        if (!configEnvName || configEnvName === envName) {
            const { default: configValue } = (await import(filePath)) as ConfigModule;
            config.push(...configValue);
        }
    }

    return config;
}
