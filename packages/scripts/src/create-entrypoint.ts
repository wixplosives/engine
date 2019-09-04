import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import { IFeatureDefinition } from './types';

const { stringify } = JSON;

export interface ICreateEntrypointsOptions {
    features: Map<string, IFeatureDefinition>;
    envName: string;
    childEnvs: string[];
    featureName?: string;
    configName?: string;
}

export function createEntrypoint({ features, envName, childEnvs, featureName, configName }: ICreateEntrypointsOptions) {
    return `import { runEngineApp, getTopWindow } from '@wixc3/engine-core';
    
const featureLoaders = {
${Array.from(features.values())
    .map(({ scopedName, name, filePath, envFilePaths, contextFilePaths, dependencies, resolvedContexts }) => {
        const loadStatements: string[] = [];
        for (const childEnvName of childEnvs) {
            const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
            if (contextFilePath) {
                loadStatements.push(
                    `                if (resolvedContexts[${stringify(envName)}] === ${stringify(childEnvName)}) {
                   await import(/* webpackChunkName: "${name}" */ ${stringify(contextFilePath)});
                }`
                );
            }
        }
        const envFilePath = envFilePaths[envName];
        if (envFilePath) {
            loadStatements.push(
                `                await import(/* webpackChunkName: "${name}" */ ${stringify(envFilePath)});`
            );
        }

        return `    '${scopedName}': {
            async load(resolvedContexts) {${loadStatements.length ? '\n' + loadStatements.join('\n') : ''}
                return (await import(/* webpackChunkName: "${name}" */ ${stringify(filePath)})).default;
            },
            depFeatures: ${stringify(dependencies)},
            resolvedContexts: ${stringify(resolvedContexts)},
        }`;
    })
    .join(',\n')}
};
        
async function main() {
    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    const options = new URLSearchParams(topWindow.location.search);

    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${stringify(configName)};
    const config = []
    config.push(...await (await fetch('/config/' + configName + '?env=${envName}&feature=' + featureName)).json());

    const runtimeEngine = await runEngineApp(
        { featureName, configName, featureLoaders, config, options, envName: '${envName}' }
    );

    return runtimeEngine;
}

main().catch(console.error);
`;
}
