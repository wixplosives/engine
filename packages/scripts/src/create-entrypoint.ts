import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import { IFeatureDefinition, IConfigDefinition } from './types';
import { SetMultiMap } from '@wixc3/engine-core';
import { join } from 'path';

const { stringify } = JSON;

export interface ICreateEntrypointsOptions {
    features: Map<string, IFeatureDefinition>;
    envName: string;
    childEnvs: string[];
    featureName?: string;
    configName?: string;
    publicPath?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    mode: 'development' | 'production';
}

const getAllValidConfigurations = (configurations: [string, IConfigDefinition][], envName: string) => {
    const configNameToFiles: Record<string, string[]> = {};

    configurations.map(([configName, { filePath, envName: configEnvName }]) => {
        if (!configNameToFiles[configName]) {
            configNameToFiles[configName] = [];
        }
        if (!configEnvName || configEnvName === envName) {
            configNameToFiles[configName].push(filePath);
        }
    });

    return configNameToFiles;
};

const getConfigLoaders = (
    configurations: SetMultiMap<string, IConfigDefinition>,
    mode: 'development' | 'production',
    configName?: string
) => {
    if (mode === 'production' && configName) {
        return [...configurations.entries()].filter(([scopedConfigName]) => scopedConfigName === configName);
    }
    return [...configurations.entries()];
};

export function createEntrypoint({
    features,
    envName,
    childEnvs,
    featureName,
    configName,
    publicPath,
    configurations,
    mode
}: ICreateEntrypointsOptions) {
    const configurationsToLoad = getConfigLoaders(configurations, mode, configName);

    const configs = getAllValidConfigurations(configurationsToLoad, envName);
    return `
import { runEngineApp, getTopWindow } from '@wixc3/engine-core';
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



const configLoaders = {
    ${configurationsToLoad
        .map(([scopedName, { envName: configEnvName }]) => {
            const importedConfigPaths = configs[scopedName].map(
                filePath =>
                    `import(/* webpackChunkName: "${filePath}" */ /* webpackMode: "${
                        mode === 'production' && configName ? 'eager' : 'lazy'
                    }" */ ${JSON.stringify(
                        join(__dirname, '..', 'loaders', 'top-level-config-loader') + '!' + filePath
                    )})`
            );

            return !configEnvName || configEnvName === envName
                ? `   '${scopedName}': async () => (await Promise.all([${importedConfigPaths.join(',')}]))`
                : '';
        })
        .filter(config => config)
        .join(',\n')}
}

async function main() {
    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    const options = new URLSearchParams(topWindow.location.search);

    const publicPath = options.has('publicPath') ? options.get('publicPath') : ${
        typeof publicPath === 'string' ? JSON.stringify(publicPath) : '__webpack_public_path__'
    };
    __webpack_public_path__= publicPath;

    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${stringify(configName)};
    const config = [];
    if(configName) {
        const loadedConfigurations = (await configLoaders[configName]()).map(importedConfig=> importedConfig.default).filter(importedConfig => importedConfig.length).flat();
        config.push(...loadedConfigurations);
    }
    
    config.push(...await (await fetch('config/' + configName + '?env=${envName}&feature=' + featureName)).json());
    
    const runtimeEngine = await runEngineApp(
        { featureName, configName, featureLoaders, config, options, envName: '${envName}', publicPath }
    );

    return runtimeEngine;
}

main().catch(console.error);
`;
}
