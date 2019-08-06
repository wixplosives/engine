import { IFeatureDefinition } from './analyze-feature';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';

export interface ICreateEntrypointsOptions {
    features: Map<string, IFeatureDefinition>;
    envName: string;
    childEnvName?: string;
    featureName?: string;
    configName?: string;
}

export function createEntrypoint({
    features,
    envName,
    childEnvName,
    featureName,
    configName
}: ICreateEntrypointsOptions) {
    return `import { runEngineApp, getTopWindow } from '@wixc3/engine-core';
    
const featureLoaders = {
${Array.from(features.values())
    .map(({ scopedName, name, filePath, envFilePaths, contextFilePaths, dependencies, resolvedContexts }) => {
        const envSetupFilePaths: string[] = [];
        if (childEnvName !== undefined) {
            const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
            if (contextFilePath) {
                envSetupFilePaths.push(contextFilePath);
            }
        }
        const envFilePath = envFilePaths[envName];
        if (envFilePath) {
            envSetupFilePaths.push(envFilePath);
        }

        return `    '${scopedName}': {
            async load() {
${envSetupFilePaths
    .map(
        setupFilePath =>
            `                await import(/* webpackChunkName: "${name}" */ ${JSON.stringify(setupFilePath)});`
    )
    .join('\n')}
                return (await import(/* webpackChunkName: "${name}" */ ${JSON.stringify(filePath)})).default;
            },
            depFeatures: ${JSON.stringify(dependencies)},
            resolvedContexts: ${JSON.stringify(resolvedContexts)},
        }`;
    })
    .join(',\n')}
};
        
async function main() {
    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    const options = new URLSearchParams(topWindow.location.search);

    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${JSON.stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${JSON.stringify(configName)};
    const config = []
    config.push(...await (await fetch('/config/' + configName + '?feature=' + featureName)).json());

    const runtimeEngine = await runEngineApp(
        { featureName, configName, featureLoaders, config, options }
    );

    return runtimeEngine;
}

main().catch(console.error);
`;
}
