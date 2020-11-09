import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition, IConfigDefinition } from './types';

const { stringify } = JSON;
const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');

export interface ICreateEntrypointsOptions {
    features: ReadonlyMap<string, IFeatureDefinition>;
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

export interface WebpackFeatureLoaderArguments extends IFeatureDefinition {
    childEnvs: string[];
    envName: string;
    publicPath?: string;
}

export type LoadStatement = Pick<
    WebpackFeatureLoaderArguments,
    'childEnvs' | 'envName' | 'contextFilePaths' | 'envFilePaths' | 'name' | 'preloadFilePaths'
>;

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
import { getTopWindow, FeatureLoadersRegistry, runEngineApp } from '@wixc3/engine-core';

const featureLoaders = new Map(Object.entries({
    ${createFeatureLoaders(features.values(), envName, childEnvs)}
}));

${staticBuild ? createConfigLoadersObject(configs) : ''}
async function main() {
    const envName = '${envName}';
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
    const rootFeatureLoader = featureLoaders.get(featureName);
    if(!rootFeatureLoader) {
        throw new Error("cannot find feature '" + featureName + "'. available features: " + Object.keys(featureLoaders).join(', '));
    }
    const { resolvedContexts = {} } = rootFeatureLoader;
    const featureLoader = new FeatureLoadersRegistry(featureLoaders, resolvedContexts);

    const features = await featureLoader.getLoadedFeatures(featureName);

    const runtimeEngine = runEngineApp(
        { config, options, envName, publicPath, features, resolvedContexts }
    );
    

    return runtimeEngine;
}

main().catch(console.error);
`;
}

function webpackImportStatement(moduleIdentifier: string, filePath: string) {
    return `await import(/* webpackChunkName: "${moduleIdentifier}" */ ${stringify(filePath)});`;
}

function createFeatureLoaders(features: Iterable<IFeatureDefinition>, envName: string, childEnvs: string[]) {
    return Array.from(features)
        .map((args) => webpackFeatureLoader({ ...args, envName, childEnvs }))
        .join(',\n');
}

function webpackFeatureLoader(args: WebpackFeatureLoaderArguments) {
    return `    '${args.scopedName}': ${createLoaderInterface(args)}`;
}

function loadEnvAndContextFiles({
    childEnvs,
    contextFilePaths,
    envName,
    name,
    envFilePaths,
    preloadFilePaths,
}: LoadStatement) {
    // This flag later indicates whether resolvedContexts need to be passed to the preload/load functions
    let usesResolvedContexts = false;
    const loadStatements: string[] = [];
    const preloadStatements: string[] = [];
    for (const childEnvName of childEnvs) {
        const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
        if (contextFilePath) {
            usesResolvedContexts = true;
            loadStatements.push(`if (resolvedContexts[${JSON.stringify(envName)}] === ${JSON.stringify(childEnvName)}) {
                ${webpackImportStatement(name, contextFilePath)};
            }`);
        }
        const preloadFilePath = preloadFilePaths[`${envName}/${childEnvName}`];
        if (preloadFilePath) {
            // If a context env has a preload file, it's the same as resolving a context
            usesResolvedContexts = true;
            preloadStatements.push(`if (resolvedContexts[${stringify(envName)}] === ${stringify(childEnvName)}) {
                ${webpackImportStatement(name, preloadFilePath)};
            }`);
        }
    }
    const envFilePath = envFilePaths[envName];
    if (envFilePath) {
        loadStatements.push(webpackImportStatement(`[${envName}]${name}`, envFilePath));
    }
    const preloadFilePath = preloadFilePaths[envName];
    if (preloadFilePath) {
        preloadStatements.push(webpackImportStatement(`[${envName}]${name}`, preloadFilePath));
    }
    return { usesResolvedContexts, loadStatements, preloadStatements };
}

function createLoaderInterface(args: WebpackFeatureLoaderArguments) {
    const { name, filePath, dependencies, resolvedContexts } = args;
    const { loadStatements, usesResolvedContexts, preloadStatements } = loadEnvAndContextFiles(args);
    return `{
                    async load(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                        ${loadStatements.length ? '\n' + loadStatements.join('\n') : ''}
                        const featureModule = ${webpackImportStatement(`[feature]${name}`, filePath)};
                        return featureModule.default;
                    },
                    async preLoad(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                        ${preloadStatements.join('\n')}
                    },
                    depFeatures: ${stringify(dependencies)},
                    resolvedContexts: ${stringify(resolvedContexts)},
                }`;
}

function addOverrideConfig(config: TopLevelConfig) {
    return `config.push(...${JSON.stringify(config)})`;
}

function loadConfigFile(filePath: string, scopedName: string, configEnvName: string | undefined): string {
    return `import(/* webpackChunkName: "${filePath}" */ /* webpackMode: 'eager' */ ${JSON.stringify(
        topLevelConfigLoaderPath + `?scopedName=${scopedName}&envName=${configEnvName!}!` + filePath
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
