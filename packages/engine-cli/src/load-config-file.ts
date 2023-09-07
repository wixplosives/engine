import { pathToFileURL } from 'node:url';
import { dynamicImport } from '@wixc3/engine-runtime-node';

export async function loadConfigFile(filePath: string): Promise<object> {
    try {
        const config = (await dynamicImport(pathToFileURL(filePath))).default;
        if (!config || typeof config !== 'object') {
            throw new Error(`config file: ${filePath} must export an object`);
        }
        return config;
    } catch (ex) {
        throw new Error(`failed evaluating config file: ${filePath}\n${ex}`);
    }
}
