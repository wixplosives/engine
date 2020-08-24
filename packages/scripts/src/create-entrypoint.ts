import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition, IConfigDefinition } from './types';
import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
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
    staticBuild: boolean;
    mode: 'production' | 'development';
    publicConfigsRoute?: string;
    config?: TopLevelConfig;
}
interface IConfigFileMapping {
    filePath: string;
    configEnvName?: string;
}

const getAllValidConfigurations = (configurations: [string, IConfigDefinition][], envName: string) => {
    const configNameToFiles: Record<string, IConfigFileMapping[]> = {};

    configurations.map(([configName, { filePath, envName: configEnvName }]) => {
        if (!configNameToFiles[configName]) {
            configNameToFiles[configName] = [];
        }
        if (!configEnvName || configEnvName === envName) {
            configNameToFiles[configName].push({ filePath, configEnvName });
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
    mode,
    staticBuild,
    publicConfigsRoute,
    config,
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), envName);
    return `
import { runEngineApp, getTopWindow } from '@wixc3/engine-core';

const featureLoaders = {
${Array.from(features.values())
    .map(({ scopedName, name, filePath, envFilePaths, contextFilePaths, dependencies, resolvedContexts }) => {
        const loadStatements: string[] = [];
        let usesResolvedContexts = false;
        for (const childEnvName of childEnvs) {
            const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
            if (contextFilePath) {
                usesResolvedContexts = true;
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
                `                await import(/* webpackChunkName: "[${envName}]${name}" */ ${stringify(envFilePath)});`
            );
        }

        return `    '${scopedName}': {
            async load(${usesResolvedContexts ? 'resolvedContexts' : ''}) {${
            loadStatements.length ? '\n' + loadStatements.join('\n') : ''
        }
                return (await import(/* webpackChunkName: "[feature]${name}" */ ${stringify(filePath)})).default;
            },
            depFeatures: ${stringify(dependencies)},
            resolvedContexts: ${stringify(resolvedContexts)},
        }`;
    })
    .join(',\n')}
};


${staticBuild ? createConfigLoadersObject(configs) : ''}
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
    
    ${staticBuild ? importStaticConfigs() : ''}
    ${staticBuild && config ? addOverrideConfig(config) : ''}
    
    ${publicConfigsRoute ? fetchConfigs(publicConfigsRoute, envName) : ''}
    
    const runtimeEngine = await runEngineApp(
        { featureName, configName, featureLoaders, config, options, envName: '${envName}', publicPath }
    );

    return runtimeEngine;
}

main().catch(console.error);
`;
}

function addOverrideConfig(config: TopLevelConfig) {
    return `config.push(...${JSON.stringify(config)})`;
}

function loadConfigFile(filePath: string, scopedName: string, configEnvName: string | undefined): string {
    return `import(/* webpackChunkName: "${filePath}" */ /* webpackMode: 'eager' */ ${JSON.stringify(
        join(__dirname, 'top-level-config-loader') + `?scopedName=${scopedName}&envName=${configEnvName!}!` + filePath
    )})`;
}

function createConfigLoadersObject(configs: Record<string, IConfigFileMapping[]>) {
    return `const configLoaders = {
    ${createConfigLoaders(configs)}
}`;
}

function createConfigLoaders(configs: Record<string, IConfigFileMapping[]>) {
    return Object.keys(configs)
        .map((scopedName) => {
            const importedConfigPaths = configs[scopedName].map(({ filePath, configEnvName }) =>
                loadConfigFile(filePath, scopedName, configEnvName)
            );
            return `   '${scopedName}': async () => (await Promise.all([${importedConfigPaths.join(',')}]))`;
        })
        .join(',\n');
}

function fetchConfigs(publicConfigsRoute: string, envName: string) {
    return `config.push(...await (await fetch('${normalizeRoute(
        publicConfigsRoute
    )!}' + configName + '?env=${envName}&feature=' + featureName)).json());`;
}

function importStaticConfigs() {
    return `
    if(configName) {
        const loadedConfigurations = configLoaders[configName] ? 
            (await configLoaders[configName]()).map(module => module.default) : 
            Promise.resolve([]);
        const allLoadedConfigs = await Promise.all(loadedConfigurations); 
        config.push(...allLoadedConfigs.flat());
    }`;
}

function normalizeRoute(route?: string) {
    if (route && !route.endsWith('/')) {
        return route + '/';
    }

    return route;
}
