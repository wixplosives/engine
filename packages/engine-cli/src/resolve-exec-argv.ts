import { nodeFs as fs } from '@file-services/node';
import type { EngineConfig } from './types';
import { ENGINE_CONFIG_FILE_NAME } from './find-features/build-constants';

export async function resolveExecArgv(basePath: string) {
    const engineConfig = await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME);
    const { default: config } = (engineConfig ? await import(engineConfig) : {}) as { default?: EngineConfig };

    const execArgv = [...process.execArgv];
    if (config?.require) {
        for (const pathToRequire of config.require) {
            // https://nodejs.org/api/cli.html#-r---require-module
            execArgv.push('-r', pathToRequire);
        }
    }
    if (config?.import) {
        for (const pathToImport of config.import) {
            // https://nodejs.org/api/cli.html#--importmodule
            execArgv.push('--import', pathToImport);
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
