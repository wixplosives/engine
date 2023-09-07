import { pathToFileURL } from 'node:url';
import { dynamicImport } from './import-modules';

export async function loadConfigFile(filePath: string): Promise<object> {
    try {
        let config = (await dynamicImport(pathToFileURL(filePath))) as { default?: object };
        config = config.default ?? config;
        if (!config || typeof config !== 'object') {
            throw new Error(`config file: ${filePath} must export an object`);
        }
        return config;
    } catch (ex) {
        throw new Error(`failed evaluating config file: ${filePath}\n${ex}`);
    }
}
