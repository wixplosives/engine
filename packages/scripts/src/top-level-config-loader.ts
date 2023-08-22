import type { TopLevelConfig } from '@wixc3/engine-core';
import type webpack from 'webpack';
import { importFresh } from './import-fresh.js';

export interface TopLevelConfigLoaderOptions {
    scopedName: string;
    envName?: string;
    configLoaderModuleName: string;
}

const topLevelConfigLoader: webpack.LoaderDefinition<TopLevelConfigLoaderOptions> = async function () {
    const { scopedName, envName, configLoaderModuleName } = this.getOptions();
    if (!scopedName) {
        throw new Error('scopedName is required');
    } else if (!configLoaderModuleName) {
        throw new Error('configLoaderModuleName is required');
    }
    const topLevelConfig = (await importFresh(this.resourcePath)) as TopLevelConfig;
    const configFileName = envName ? `${scopedName}.${envName}` : scopedName;
    const configPath = `configs/${configFileName}.json`;

    this.emitFile(configPath, JSON.stringify(topLevelConfig));

    return `import { loadConfig } from "${configLoaderModuleName}";
const fetchResult = loadConfig("${scopedName}", "${envName}");
export default fetchResult`;
};

export default topLevelConfigLoader;
