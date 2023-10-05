import { nodeFs as fs } from '@file-services/node';
import { pathToFileURL } from 'node:url';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants.js';
import type { EngineConfig } from './types.js';

export async function resolveExecArgv(basePath: string) {
    const engineConfig = await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME);
    const { default: config } = (engineConfig ? await import(pathToFileURL(engineConfig).href) : {}) as {
        default?: EngineConfig;
    };

    const execArgv = [...process.execArgv];
    if (config?.require) {
        for (const pathToRequire of config.require) {
            // https://nodejs.org/api/cli.html#-r---require-module
            execArgv.push('-r', pathToRequire);
        }
    }
    if (config?.buildConditions) {
        for (const condition of config.buildConditions) {
            // https://nodejs.org/api/cli.html#-c-condition---conditionscondition
            execArgv.push('-C', condition);
        }
    }
    return execArgv;
}
