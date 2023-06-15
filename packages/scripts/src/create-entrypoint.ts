import { Environment, TopLevelConfig } from '@wixc3/engine-core';
import { IEnvironmentDescriptor } from '@wixc3/engine-runtime-node';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { SetMultiMap } from '@wixc3/patterns';

import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition } from './types';

const { stringify } = JSON;
export const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');
export const LOADED_FEATURE_MODULES_NAMESPACE = '_engine_';

//#region types

export interface ICreateEntrypointsOptions {
    features: ReadonlyMap<string, IFeatureDefinition>;
    childEnvs: string[];
    featureName?: string;
    configName?: string;
    publicPath?: string;
    publicPathVariableName?: string;
    configurations: SetMultiMap<string, IConfigDefinition>;
    staticBuild: boolean;
    mode: 'production' | 'development';
    publicConfigsRoute?: string;
    config?: TopLevelConfig;
    eagerEntrypoint?: boolean;
    env: IEnvironmentDescriptor;
    featuresBundleName?: string;
    configLoaderModuleName?: string;
}

interface IConfigFileMapping {
    filePath: string;
    configEnvName?: string;
}

export interface ExternalEntrypoint extends IFeatureDefinition {
    childEnvs: string[];
    env: IEnvironmentDescriptor;
    publicPath?: string;
}

export interface ExternalBrowserEntrypoint extends ExternalEntrypoint {
    loadStatement: (args: LoadStatementArguments) => string;
}

export interface WebpackFeatureLoaderArguments extends ExternalBrowserEntrypoint {
    eagerEntrypoint?: boolean;
    featuresBundleName?: string;
}

export type LoadStatement = Pick<
    WebpackFeatureLoaderArguments,
    | 'childEnvs'
    | 'env'
    | 'contextFilePaths'
    | 'envFilePaths'
    | 'scopedName'
    | 'loadStatement'
    | 'packageName'
    | 'directoryPath'
    | 'preloadFilePaths'
    | 'eagerEntrypoint'
>;

export interface LoadStatementArguments
    extends Pick<WebpackFeatureLoaderArguments, 'filePath' | 'directoryPath' | 'packageName'> {
    moduleIdentifier: string;
    eagerEntrypoint?: boolean;
}
//#endregion

//#region entry points

export function createExternalNodeEntrypoint(args: ExternalEntrypoint) {
    return `module.exports = {
        '${args.scopedName}': ${createLoaderInterface({
        ...args,
        loadStatement: nodeImportStatement,
    })} 
}
    `;
}

const engineCodeFullPath = stringify(require.resolve('@wixc3/engine-core'));

export function createMainEntrypoint({
    features,
    childEnvs,
    featureName,
    configName,
    publicPath,
    publicPathVariableName,
    configurations,
    mode,
    staticBuild,
    publicConfigsRoute,
    config,
    eagerEntrypoint,
    env,
    featuresBundleName,
    configLoaderModuleName = '@wixc3/engine-scripts/dist/default-config-loader',
}: ICreateEntrypointsOptions) {
    const envName = env.name;
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), envName);

    const featureLoaders = createFeatureLoaders(features.values(), childEnvs, env, eagerEntrypoint, featuresBundleName);

    return `
import * as EngineCore from ${engineCodeFullPath};
globalThis.EngineCore ||= EngineCore;
const { getTopWindow, FeatureLoadersRegistry, RuntimeEngine, COM } = EngineCore;
const featureLoaders = new Map(Object.entries({
    ${featureLoaders}
}));

self.${LOADED_FEATURE_MODULES_NAMESPACE} = {};

${staticBuild ? createConfigLoadersObject(configLoaderModuleName, configs) : ''}
async function main() {
    const envName = '${envName}';
    const currentWindow = typeof self !== 'undefined' ? self : window;
    const topWindow = currentWindow.parent ?? currentWindow;
    const isMainEntrypoint = topWindow && currentWindow === topWindow;
    const urlParams = new URLSearchParams(currentWindow.location.search);
    const options = currentWindow.engineEntryOptions ? currentWindow.engineEntryOptions({urlParams, envName}) : urlParams;
    const env = ${stringify(
        new Environment(env.name, env.type, env.env.endpointType, env.flatDependencies?.map((d) => d.env) ?? [])
    )}
    
    let publicPath = ${typeof publicPath === 'string' ? stringify(publicPath) : '__webpack_public_path__'}
    if (options.has('publicPath')) {
        publicPath = options.get('publicPath');
    } else if (${typeof publicPathVariableName === 'string'} && topWindow.${publicPathVariableName}) {
        publicPath = topWindow.${publicPathVariableName};
    }

    __webpack_public_path__ = publicPath;
    
    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${stringify(configName)};
    
    /*********************************************************************/
    const rootFeatureLoader = featureLoaders.get(featureName);
    if(!rootFeatureLoader) {
        throw new Error("cannot find feature '" + featureName + "'. available features:\\n" + Array.from(featureLoaders.keys()).join('\\n'));
    }
    const { resolvedContexts = {} } = rootFeatureLoader;
    const featureLoader = new FeatureLoadersRegistry(featureLoaders, resolvedContexts);
    /*********************************************************************/
    
    /*********************************************************************/
    const instanceId = options.get(EngineCore.INSTANCE_ID_PARAM_NAME);
    if (instanceId) {
        currentWindow.name = instanceId;
    }
    /*********************************************************************/
    
    /*********************************************************************/
    const config = [
        COM.use({ config: { resolvedContexts, publicPath } })
    ];
    ${populateConfig(envName, staticBuild, publicConfigsRoute, config)}
    /*********************************************************************/

    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName);
    return new RuntimeEngine(env, config, options).run([loadedFeatures[loadedFeatures.length - 1]]);
}

main().catch(console.error);
`;
}

//#endregion

//#region webpack import statements
export function webpackImportStatement({ moduleIdentifier, filePath, eagerEntrypoint }: LoadStatementArguments) {
    return `await import(/* webpackChunkName: "${moduleIdentifier}" */${
        eagerEntrypoint ? ` /* webpackMode: 'eager' */` : ''
    } ${stringify(filePath)});`;
}

export function nodeImportStatement({ filePath }: LoadStatementArguments) {
    return `require(${stringify(filePath)})`;
}

//#endregion

//#region feature loaders generation
function createFeatureLoaders(
    features: Iterable<IFeatureDefinition>,
    childEnvs: string[],
    env: IEnvironmentDescriptor,
    eagerEntrypoint?: boolean,
    featuresBundleName?: string
) {
    return Array.from(features)
        .map(
            (args) =>
                `    '${args.scopedName}': ${createLoaderInterface({
                    ...args,
                    childEnvs,
                    loadStatement: webpackImportStatement,
                    eagerEntrypoint,
                    env,
                    featuresBundleName,
                })}`
        )
        .join(',\n');
}

function loadEnvAndContextFiles({
    childEnvs,
    contextFilePaths,
    scopedName,
    envFilePaths,
    loadStatement,
    directoryPath,
    packageName,
    preloadFilePaths,
    eagerEntrypoint,
    env,
}: LoadStatement) {
    let usesResolvedContexts = false;
    const loadStatements: string[] = [];
    const preloadStatements: string[] = [];
    for (const childEnvName of childEnvs) {
        const contextFilePath = contextFilePaths[`${env.name}/${childEnvName}`];
        if (contextFilePath) {
            usesResolvedContexts = true;
            loadStatements.push(`if (resolvedContexts[${stringify(env.name)}] === ${stringify(childEnvName)}) {
                ${loadStatement({
                    moduleIdentifier: scopedName,
                    filePath: contextFilePath,
                    directoryPath,
                    packageName,
                    eagerEntrypoint,
                })};
            }`);
        }
        const preloadFilePath = preloadFilePaths?.[`${env.name}/${childEnvName}`];
        if (preloadFilePath) {
            // If a context env has a preload file, it's the same as resolving a context
            usesResolvedContexts = true;
            preloadStatements.push(`if (resolvedContexts[${stringify(env.name)}] === ${stringify(childEnvName)}) {
                ${webpackImportStatement({
                    directoryPath,
                    filePath: preloadFilePath,
                    moduleIdentifier: scopedName,
                    packageName,
                    eagerEntrypoint,
                })};
            }`);
        }
    }
    for (const { name: envName } of new Set([env, ...(env.flatDependencies ?? [])])) {
        const envFilePath = envFilePaths[envName];
        if (envFilePath) {
            loadStatements.push(
                loadStatement({
                    moduleIdentifier: `[${envName}]${scopedName}`,
                    filePath: envFilePath,
                    directoryPath,
                    packageName,
                    eagerEntrypoint,
                })
            );
        }
    }
    const preloadFilePath = preloadFilePaths?.[env.name];
    if (preloadFilePath) {
        preloadStatements.push(
            webpackImportStatement({
                moduleIdentifier: `[${env.name}]${scopedName}`,
                filePath: preloadFilePath,
                directoryPath,
                packageName,
                eagerEntrypoint,
            })
        );
    }
    return { usesResolvedContexts, loadStatements, preloadStatements };
}

function createLoaderInterface(args: WebpackFeatureLoaderArguments) {
    const {
        filePath,
        dependencies,
        resolvedContexts,
        loadStatement,
        packageName,
        directoryPath,
        eagerEntrypoint,
        featuresBundleName = 'features',
    } = args;
    const { loadStatements, usesResolvedContexts, preloadStatements } = loadEnvAndContextFiles(args);
    return `{
                async load(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                    ${loadStatements.length ? loadStatements.join(';\n') : ''}
                    const featureModule = ${loadStatement({
                        moduleIdentifier: featuresBundleName,
                        filePath,
                        directoryPath,
                        packageName,
                        eagerEntrypoint,
                    })};
                    return featureModule.default;
                },
                async preload(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                    ${preloadStatements.join('\n')}
                },
                depFeatures: ${stringify(dependencies)},
                resolvedContexts: ${stringify(resolvedContexts)},
            }`;
}
//#endregion

//#region config loaders
const getAllValidConfigurations = (configurations: [string, IConfigDefinition][], envName: string) => {
    const configNameToFiles: Record<string, IConfigFileMapping[]> = {};

    configurations.map(([configName, { filePath, envName: configEnvName }]) => {
        if (!configNameToFiles[configName]) {
            configNameToFiles[configName] = [];
        }
        if (!configEnvName || configEnvName === envName) {
            configNameToFiles[configName]!.push({ filePath, configEnvName });
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

function createConfigLoadersObject(configLoaderModuleName: string, configs: Record<string, IConfigFileMapping[]>) {
    return `const configLoaders = {
    ${createConfigLoaders(configLoaderModuleName, configs)}
}`;
}

function createConfigLoaders(configLoaderModuleName: string, configs: Record<string, IConfigFileMapping[]>) {
    return Object.keys(configs)
        .map((scopedName) => {
            const importedConfigPaths = configs[scopedName]!.map(({ filePath, configEnvName }) =>
                loadConfigFile(configLoaderModuleName, filePath, scopedName, configEnvName)
            );
            return `   '${scopedName}': async () => (await Promise.all([${importedConfigPaths.join(',')}]))`;
        })
        .join(',\n');
}

function loadConfigFile(
    configLoaderModuleName: string,
    filePath: string,
    scopedName: string,
    configEnvName: string | undefined
): string {
    return `import(/* webpackChunkName: "[config]${scopedName}${
        configEnvName ?? ''
    }" */ /* webpackMode: 'eager' */ ${stringify(
        topLevelConfigLoaderPath +
            `?configLoaderModuleName=${configLoaderModuleName}&scopedName=${scopedName}&envName=${configEnvName!}!` +
            filePath
    )})`;
}
//#endregion

//#region configs
function populateConfig(envName: string, staticBuild?: boolean, publicConfigsRoute?: string, config?: TopLevelConfig) {
    return `${staticBuild ? importStaticConfigs() : ''}
${staticBuild && config ? addOverrideConfig(config) : ''}

${publicConfigsRoute ? getRemoteConfigs(publicConfigsRoute, envName) : ''}

${publicConfigsRoute ? `${addConfigsEventListenerForParentEnvironments(publicConfigsRoute)}` : ''}`;
}

function getRemoteConfigs(publicConfigsRoute: string, envName: string) {
    return `config.push(...await (async () =>{
        if(!isMainEntrypoint) {
            ${getConfigsFromParent(publicConfigsRoute, envName)}   
        } else {
            ${fetchConfigs(publicConfigsRoute, envName)}
        }
    })());`;
}

function fetchConfigs(publicConfigsRoute: string, envName: string) {
    return `return (await fetch('${normalizeRoute(
        publicConfigsRoute
    )}' + configName + '?env=${envName}&feature=' + featureName)).json();`;
}

function addOverrideConfig(config: TopLevelConfig) {
    return `config.push(...${stringify(config)})`;
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

function addConfigsEventListenerForParentEnvironments(publicConfigsRoute: string) {
    return `if(isMainEntrypoint) {
        const fetchedConfigs = {};
        const configsEventListener = async ({ data: { id, envName }, source }) => {
            if(source && id === '${publicConfigsRoute}') {
                if(!fetchedConfigs[envName]) {
                    const config = await (await fetch('${normalizeRoute(
                        publicConfigsRoute
                    )}/' + configName + '?env=' + envName + '&feature=' + featureName)).json();
                    fetchedConfigs[envName] = config;
                }
                source.postMessage({
                    id,
                    config: fetchedConfigs[envName]
                }, '*');
            }
        }
        currentWindow.addEventListener('message', configsEventListener);
    }`;
}

function getConfigsFromParent(publicConfigsRoute: string, envName: string) {
    return `return new Promise((res) => {
        const configsHandler = ({ data: { id, config } }) => {
            if(id === '${publicConfigsRoute}') {
                currentWindow.removeEventListener('message', configsHandler);
                res(config);
            }
        };
        currentWindow.addEventListener('message', configsHandler);
        topWindow.postMessage({
            id: '${publicConfigsRoute}',
            envName: '${envName}'
        }, '*');
    });`;
}
//#endregion

function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}

export function normilizePackageName(packageName: string) {
    return packageName.replace('@', '').replace(/\//g, '').replace(/-/g, '');
}
