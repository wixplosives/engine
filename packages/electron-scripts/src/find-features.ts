import fs from '@file-services/node';
import { EngineConfig, ENGINE_CONFIG_FILE_NAME } from '@wixc3/engine-scripts';

export async function getEngineConfig(basePath: string): Promise<EngineConfig | undefined> {
    const engineConfigFilePath = await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME);
    if (engineConfigFilePath) {
        try {
            return (await import(engineConfigFilePath)) as EngineConfig;
        } catch (err) {
            throw new Error(`failed evaluating config file: ${engineConfigFilePath} ${String(err)}`);
        }
    }
    return undefined;
}
