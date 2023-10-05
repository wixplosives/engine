import { nodeFs as fs } from '@file-services/node';
import { ENGINE_CONFIG_FILE_NAME, type EngineConfig } from '@wixc3/engine-scripts';
import { pathToFileURL } from 'node:url';

export async function getEngineConfig(basePath: string, configFilePath?: string): Promise<EngineConfig | undefined> {
    const engineConfigFilePath =
        configFilePath ?? (await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME));
    if (engineConfigFilePath) {
        try {
            return ((await import(pathToFileURL(engineConfigFilePath).href)) as { default: EngineConfig }).default;
        } catch (err) {
            throw new Error(`failed importing config file: ${engineConfigFilePath}`, { cause: err });
        }
    }
    return undefined;
}
