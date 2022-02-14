import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import { parse, resolve } from 'path';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition } from './types';

const { stringify } = JSON;
const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');
export const LOADED_FEATURE_MODULES_NAMESPACE = '_engine_';

//#region types

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
    target: 'webworker' | 'web' | 'electron-renderer';
    externalFeaturesRoute: string;
    eagerEntrypoint?: boolean;
    featuresBundleName?: string;
    configLoaderModuleName?: string;
}
interface IConfigFileMapping {
    filePath: string;
    configEnvName?: string;
}

export interface ExternalEntrypoint extends IFeatureDefinition {
    childEnvs: string[];
    envName: string;
    publicPath?: string;
}

export interface ExternalBrowserEntrypoint extends ExternalEntrypoint {
    loadStatement: (args: LoadStatementArguments) => string;
}

export interface WebpackFeatureLoaderArguments extends ExternalBrowserEntrypoint {
    target: 'web' | 'webworker' | 'node' | 'electron-renderer';
    eagerEntrypoint?: boolean;
    featuresBundleName?: string;
}

export type LoadStatement = Pick<
    WebpackFeatureLoaderArguments,
    | 'childEnvs'
    | 'envName'
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

export function createExternalBrowserEntrypoint(args: WebpackFeatureLoaderArguments) {
    return `
    import { getTopWindow } from ${JSON.stringify(require.resolve('@wixc3/engine-core'))};
    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    ${setExternalPublicPath(args.envName, args.target, args.scopedName)}
    __webpack_public_path__= publicPath;
    self.runtimeFeatureLoader.register('${args.scopedName}', ${createLoaderInterface(args)});
    ;
    `;
}

export function createExternalNodeEntrypoint(args: ExternalEntrypoint) {
    return `module.exports = {
        '${args.scopedName}': ${createLoaderInterface({
        ...args,
        target: 'node',
        loadStatement: nodeImportStatement,
    })} 
}
    `;
}

export function createMainEntrypoint({
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
    target,
    externalFeaturesRoute,
    eagerEntrypoint,
    featuresBundleName,
    configLoaderModuleName = resolve(__dirname, 'default-config-loader')
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), envName);
    return `
import * as EngineCore from ${JSON.stringify(require.resolve('@wixc3/engine-core'))};
if(!self.EngineCore) {
    self.EngineCore = EngineCore;
}
const { getTopWindow, FeatureLoadersRegistry, runEngineApp } = EngineCore;

const featureLoaders = new Map(Object.entries({
    ${createFeatureLoaders(features.values(), envName, childEnvs, target, eagerEntrypoint, featuresBundleName)}
}));

self.${LOADED_FEATURE_MODULES_NAMESPACE} = {};

${staticBuild ? createConfigLoadersObject(configLoaderModuleName, configs) : ''}
async function main() {
    const envName = '${envName}';
    const currentWindow = typeof self !== 'undefined' ? self : window;
    const topWindow = getTopWindow(currentWindow);
    const options = new URLSearchParams(topWindow.location.search);
    const isMainEntrypoint = topWindow && currentWindow === topWindow;

    const publicPath = options.has('publicPath') ? options.get('publicPath') : ${
        typeof publicPath === 'string' ? JSON.stringify(publicPath) : '__webpack_public_path__'
    };
    __webpack_public_path__= publicPath;

    const featureName = options.get('${FEATURE_QUERY_PARAM}') || ${stringify(featureName)};
    const configName = options.get('${CONFIG_QUERY_PARAM}') || ${stringify(configName)};
    const config = [];

    ${populateConfig(envName, staticBuild, publicConfigsRoute, config)}

    const rootFeatureLoader = featureLoaders.get(featureName);
    if(!rootFeatureLoader) {
        throw new Error("cannot find feature '" + featureName + "'. available features:\\n" + Array.from(featureLoaders.keys()).join('\\n'));
    }
    const { resolvedContexts = {} } = rootFeatureLoader;
    const featureLoader = new FeatureLoadersRegistry(featureLoaders, resolvedContexts);

    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName);
    const features = [loadedFeatures[loadedFeatures.length - 1]];
    ${loadExternalFeatures(target, externalFeaturesRoute)}

    const runtimeEngine = runEngineApp(
        { config, options, envName, publicPath, features, resolvedContexts }
    );

    return runtimeEngine;
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
    envName: string,
    childEnvs: string[],
    target: 'web' | 'webworker' | 'node' | 'electron-renderer',
    eagerEntrypoint?: boolean,
    featuresBundleName?: string
) {
    return Array.from(features)
        .map(
            (args) =>
                `    '${args.scopedName}': ${createLoaderInterface({
                    ...args,
                    envName,
                    childEnvs,
                    loadStatement: webpackImportStatement,
                    target,
                    eagerEntrypoint,
                    featuresBundleName,
                })}`
        )
        .join(',\n');
}

function loadEnvAndContextFiles({
    childEnvs,
    contextFilePaths,
    envName,
    scopedName: moduleIdentifier,
    envFilePaths,
    loadStatement,
    directoryPath,
    packageName,
    preloadFilePaths,
    eagerEntrypoint,
}: LoadStatement) {
    let usesResolvedContexts = false;
    const loadStatements: string[] = [];
    const preloadStatements: string[] = [];
    for (const childEnvName of childEnvs) {
        const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
        if (contextFilePath) {
            usesResolvedContexts = true;
            loadStatements.push(`if (resolvedContexts[${JSON.stringify(envName)}] === ${JSON.stringify(childEnvName)}) {
                ${loadStatement({
                    moduleIdentifier,
                    filePath: contextFilePath,
                    directoryPath,
                    packageName,
                    eagerEntrypoint,
                })};
            }`);
        }
        const preloadFilePath = preloadFilePaths?.[`${envName}/${childEnvName}`];
        if (preloadFilePath) {
            // If a context env has a preload file, it's the same as resolving a context
            usesResolvedContexts = true;
            preloadStatements.push(`if (resolvedContexts[${stringify(envName)}] === ${stringify(childEnvName)}) {
                ${webpackImportStatement({
                    directoryPath,
                    filePath: preloadFilePath,
                    moduleIdentifier: `${envName}/${moduleIdentifier}`,
                    packageName,
                    eagerEntrypoint,
                })};
            }`);
        }
    }
    const envFilePath = envFilePaths?.[envName];
    if (envFilePath) {
        loadStatements.push(
            loadStatement({
                moduleIdentifier: `${envName}/${moduleIdentifier}`,
                filePath: envFilePath,
                directoryPath,
                packageName,
                eagerEntrypoint,
            })
        );
    }
    const preloadFilePath = preloadFilePaths?.[envName];
    if (preloadFilePath) {
        preloadStatements.push(
            webpackImportStatement({
                moduleIdentifier: `${envName}/${moduleIdentifier}`,
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
        target,
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
                    ${
                        target !== 'node'
                            ? `self.${createExternalFeatureMapping(packageName, filePath)} = featureModule;`
                            : ''
                    }
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

function loadConfigFile(configLoaderModuleName: string, filePath: string, scopedName: string, configEnvName: string | undefined): string {
    return `import(/* webpackChunkName: "[config]${scopedName}${
        configEnvName ?? ''
    }" */ /* webpackMode: 'eager' */ ${JSON.stringify(
        topLevelConfigLoaderPath + `?configLoaderModuleName=${configLoaderModuleName}&scopedName=${scopedName}&envName=${configEnvName!}!` + filePath
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
    )!}' + configName + '?env=${envName}&feature=' + featureName)).json();`;
}

function addOverrideConfig(config: TopLevelConfig) {
    return `config.push(...${JSON.stringify(config)})`;
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
                });
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
        currentWindow.addEventListener('message', configsHandler)
        topWindow.postMessage({
            id: '${publicConfigsRoute}',
            envName: '${envName}'
        });
    });`;
}

//#endregion

//#region loading 3rd party features
function loadExternalFeatures(target: 'web' | 'webworker' | 'electron-renderer', externalsFilePath: string) {
    return `self.runtimeFeatureLoader = featureLoader;
    const externalFeatures = [];
    
    ${addExternalsEventListenerForParentEnvironments(externalsFilePath)}
    
    const fetchedExternalFeatures = ${
        target === 'electron-renderer'
            ? fetchFeaturesFromElectronProcess(externalsFilePath)
            : fetchExternalFeaturesInBrowser(externalsFilePath)
    };
    externalFeatures.push(...fetchedExternalFeatures)
    
    if(externalFeatures.length) {
        self.externalFeatures = externalFeatures;
        const filteredExternals = externalFeatures.filter(({ envEntries }) => envEntries[envName] && envEntries[envName]['${target}']);
        const entryPaths = filteredExternals.map(({ envEntries }) => (envEntries[envName]['${target}']));
        if(filteredExternals.length) {
            await ${target === 'webworker' ? 'importScripts' : loadScripts()}(entryPaths);
    
            for (const { scopedName } of filteredExternals) {
                for (const loadedFeature of await featureLoader.getLoadedFeatures(scopedName)) {
                    features.push(loadedFeature);
                }
            }
        }
    }`;
}

function setExternalPublicPath(envName: string, target: string, featureName: string) {
    return `const featureDef = topWindow.externalFeatures.find(({ scopedName }) => scopedName === '${featureName}');
    if(!featureDef) {
        throw new Error('trying to load feature ' + '${featureName}' + ', but it is not defined');
    }
    const curerntUrl = featureDef.envEntries['${envName}']['${target}']
    const publicPath =  curerntUrl.substring(0, curerntUrl.lastIndexOf('/') + 1);
    `;
}

function addExternalsEventListenerForParentEnvironments(externalsFilePath: string) {
    return `if(isMainEntrypoint) {
        const externalFeaturesEventListener = ({ data: { id }, source }) => {
            if(source && id === '${externalsFilePath}') {
                source.postMessage({
                    id,
                    externalFeatures
                })
            }
        }
        currentWindow.addEventListener('message', externalFeaturesEventListener);
    }`;
}

function fetchExternalFeaturesInBrowser(externalFeaturesRoute: string) {
    return `await (async () =>{
        if(!isMainEntrypoint) {
            ${getExternalFeaturesFromParent(externalFeaturesRoute)}   
        } else {
            ${fetchExternalFeatures(externalFeaturesRoute)}
        }
    })();
    `;
}

function getExternalFeaturesFromParent(externalFeaturesRoute: string) {
    return `return new Promise((res) => {
        const externalsHandler = ({ data: { id, externalFeatures } }) => {
            if(id === '${externalFeaturesRoute}') {
                currentWindow.removeEventListener('message', externalsHandler);
                res(externalFeatures);
            }
        };
        currentWindow.addEventListener('message', externalsHandler)
        topWindow.postMessage({
            id: '${externalFeaturesRoute}'
        });
    });`;
}

function fetchExternalFeatures(externalFeaturesRoute: string) {
    return `const externalFeaturesRoute = '${externalFeaturesRoute}';
            const path = publicPath + publicPath && !publicPath.endsWith('/') ? '/' : '';
            const normalizedExternalFeaturesRoute = !externalFeaturesRoute.startsWith('/') ? externalFeaturesRoute : externalFeaturesRoute.slice(1);
            return (await fetch(path + normalizedExternalFeaturesRoute)).json();
            `;
}

function fetchFeaturesFromElectronProcess(externalFeaturesRoute: string) {
    return `await require('electron').ipcRenderer.invoke('${externalFeaturesRoute}')`;
}

function loadScripts() {
    return `(function fetchScripts(scripts) {
                const loadScript = (src) =>
                    new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = src;
                        script.onload = () => resolve();
                        script.onerror = reject;
                        script.crossOrigin = 'anonymous';
                        script.type = 'module';
                        document.head.appendChild(script);
                    });

                return Promise.all(scripts.map(loadScript));
            })`;
}

export function createExternalFeatureMapping(packageName: string, featurePath: string) {
    const externalPath = `${packageName}_${parse(featurePath).name}`;
    return `${LOADED_FEATURE_MODULES_NAMESPACE}[${JSON.stringify(externalPath)}]`;
}

//#endregion
function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}

export function normilizePackageName(packageName: string) {
    return packageName.replace('@', '').replace(/\//g, '').replace(/-/g, '');
}
