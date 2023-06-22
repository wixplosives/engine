import fs from '@file-services/node';
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importModule = new Function('modulePath', 'return import(modulePath);') as (modulePath: string) => Promise<any>;

export async function loadConfigFile<T extends {}>(
    basePath: string,
    name: string
): Promise<{ config: T; path?: string }> {
    const filepath = await fs.promises.findClosestFile(basePath, name);
    if (!filepath) {
        return { config: {} as T, path: undefined };
    }
    try {
        let config = (await importModule('file://' + filepath)) as T;
        config = (config as any).default || config;
        if (!config || typeof config !== 'object') {
            throw new Error(`config file: ${filepath} must export an object`);
        }
        return {
            config,
            path: filepath,
        };
    } catch (ex) {
        throw new Error(`failed evaluating config file: ${filepath}\n${ex}`);
    }
}
