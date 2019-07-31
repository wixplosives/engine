import fs from '@file-services/node';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';

export interface ICreateEntrypointsOptions {
    environments: IEnvironment[];
    basePath: string;
    features: Map<string, IFeatureDefinition>;
    configs: Map<string, string>;
}

export function createEntrypoints({ environments, basePath, features, configs }: ICreateEntrypointsOptions) {
    const virtualSources: Record<string, string> = {};

    for (const { name: envName, type, childEnvName } of environments) {
        const entryFilePath = fs.join(basePath, `${envName}-${type}-entry.js`);
        const entryFileContents = `import { runEngineApp, getTopWindow } from '@wixc3/engine-core';

${generateFeatureLoaders(features, envName, childEnvName)}

${generateConfigLoaders(configs)}

${mainFn}
`;
        virtualSources[entryFilePath] = entryFileContents;
    }

    return virtualSources;
}

function generateFeatureLoaders(features: Map<string, IFeatureDefinition>, envName: string, childEnvName?: string) {
    return `const featureLoaders = {
${Array.from(features.values())
    .map(({ scopedName, filePath, envFilePaths, contextFilePaths, dependencies, resolvedContexts }) => {
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
${envSetupFilePaths.map(setupFilePath => `            await import(${JSON.stringify(setupFilePath)});`).join('\n')}
            return (await import('${JSON.stringify(filePath)}')).default;
        },
        depFeatures: ${JSON.stringify(dependencies)},
        resolvedContexts: ${JSON.stringify(resolvedContexts)},
    }`;
    })
    .join(',\n')}
};`;
}

function generateConfigLoaders(configs: Map<string, string>) {
    return `const configLoaders = {
${Array.from(configs.keys())
    .map(configName => {
        return `    '${configName}': () => fetch('/config/${configName}').then(res => res.json())`;
    })
    .join(',\n')}
};`;
}

const mainFn = `async function main() {
    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    const options = new URLSearchParams(topWindow.location.search);

    const featureName = options.get('${FEATURE_QUERY_PARAM}');
    const configName = options.get('${CONFIG_QUERY_PARAM}');
    const runtimeEngine = await runEngineApp(
        { featureName, configName, featureLoaders, configLoaders }
    );

    return runtimeEngine;
}

main().catch(console.error);`;
