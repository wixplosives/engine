import { run, TopLevelConfig } from '@wixc3/engine-core/src';
import http from 'http';
import { EngineEnvironmentDef } from '../types';

export async function runEntry(
    featureToUse: string,
    configToLoad: string,
    {
        featureMapping,
        envFiles,
        contextFiles = new Set<string>()
    }: Pick<EngineEnvironmentDef, 'envFiles' | 'featureMapping' | 'contextFiles'>,
    serverPort: number,
    overrideConfig: TopLevelConfig = []
) {
    contextFiles.forEach(contextFile => require(contextFile));
    envFiles.forEach(filePath => require(filePath));

    const mainFeature = featureMapping.mapping[featureToUse];

    /* Load config */
    const currentFeature = require(mainFeature.featureFilePath).default;
    const currentConfig = require(mainFeature.configurations[configToLoad]).default;
    const serverConfig: Array<[string, object]> = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${serverPort}/server-config.js`, response => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(JSON.parse(data));
            });
            response.on('error', err => {
                reject(err);
            });
        });
    });

    overrideConfig.push(...serverConfig);
    /* Run the engine */
    return {
        engine: run([currentFeature], [...currentConfig, ...overrideConfig]),
        runningFeature: currentFeature
    };
}
