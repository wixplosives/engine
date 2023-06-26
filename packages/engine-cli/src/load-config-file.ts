import fs from '@file-services/node';
import { pathToFileURL } from 'node:url';
import { dynamicImport } from './import-modules';

export async function loadConfigFile<T extends {}>(
    basePath: string,
    name: string
): Promise<{ config: T; path?: string }> {
    const filepath = await fs.promises.findClosestFile(basePath, name);
    if (!filepath) {
        return { config: {} as T, path: undefined };
    }
    try {
        let config = (await dynamicImport(pathToFileURL(filepath))) as T;
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
