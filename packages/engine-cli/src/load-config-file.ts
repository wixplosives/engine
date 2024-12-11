import { pathToFileURL } from 'node:url';

export async function loadConfigFile(filePath: string): Promise<object> {
    try {
        const configModuleValue = (await import(pathToFileURL(filePath).href)).default;
        const config = (configModuleValue as { default: unknown }).default ?? configModuleValue;
        if (!config || typeof config !== 'object') {
            throw new Error(`config file: ${filePath} must export an object`);
        }
        return config;
    } catch (ex) {
        throw new Error(`failed evaluating config file: ${filePath}`, { cause: ex });
    }
}
