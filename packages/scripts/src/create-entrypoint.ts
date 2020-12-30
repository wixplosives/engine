import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { extname, parse } from 'path';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition, IConfigDefinition, IExtenalFeatureDescriptor } from './types';

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
    externalFeatures: IExtenalFeatureDescriptor[];
    externalsFilePath?: string;
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
}

export type LoadStatement = Pick<
    WebpackFeatureLoaderArguments,
    | 'childEnvs'
    | 'envName'
    | 'contextFilePaths'
    | 'envFilePaths'
    | 'name'
    | 'loadStatement'
    | 'packageName'
    | 'directoryPath'
    | 'preloadFilePaths'
>;

export interface LoadStatementArguments extends Pick<IFeatureDefinition, 'filePath' | 'directoryPath' | 'packageName'> {
    moduleIdentifier: string;
}
//#endregion

//#region entry points

export function createExternalBrowserEntrypoint(args: WebpackFeatureLoaderArguments) {
    return `
    import { getTopWindow } from '@wixc3/engine-core';

    const topWindow = getTopWindow(typeof self !== 'undefined' ? self : window);
    const options = new URLSearchParams(topWindow.location.search);
    const publicPath = options.has('externalPublicPath') ? options.get('externalPublicPath') : ${
        typeof args.publicPath === 'string' ? JSON.stringify(args.publicPath) : '__webpack_public_path__'
    };
    __webpack_public_path__= publicPath;
    self.runtimeFeatureLoader.register('${args.scopedName}', ${createLoaderInterface(args)});
    ;
    `;
}

export function createExternalNodeEntrypoint(args: ExternalEntrypoint) {
    return `module.exports = {
        '${args.scopedName}': ${createLoaderInterface({ ...args, target: 'node', loadStatement: nodeImportStatement })}
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
    externalFeatures,
    externalsFilePath,
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), envName);
    return `
import * as EngineCore from '@wixc3/engine-core';
if(!self.EngineCore) {
    self.EngineCore = EngineCore;
}
const { getTopWindow, FeatureLoadersRegistry, runEngineApp } = EngineCore;

const featureLoaders = new Map(Object.entries({
    ${createFeatureLoaders(features.values(), envName, childEnvs, target)}
}));

self.${LOADED_FEATURE_MODULES_NAMESPACE} = {};

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

    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName);
    const features = [loadedFeatures[loadedFeatures.length - 1]];
    ${loadExternalFeatures(target, externalFeatures, externalsFilePath)}

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
export function webpackImportStatement({ moduleIdentifier, filePath }: LoadStatementArguments) {
    return `await import(/* webpackChunkName: "${moduleIdentifier}" */ ${stringify(filePath)});`;
}

export function nodeImportStatement(args: LoadStatementArguments) {
    return `require(${stringify(remapFileRequest(args))})`;
}

//#endregion

//#region feature loaders generation
function createFeatureLoaders(
    features: Iterable<IFeatureDefinition>,
    envName: string,
    childEnvs: string[],
    target: 'web' | 'webworker' | 'node' | 'electron-renderer'
) {
    return Array.from(features)
        .map(
            (args) =>
                `    '${args.scopedName}': ${createLoaderInterface({
                    ...args,
                    envName,
                    childEnvs,
                    loadStatement: target === 'node' ? nodeImportStatement : webpackImportStatement,
                    target,
                })}`
        )
        .join(',\n');
}

function loadEnvAndContextFiles({
    childEnvs,
    contextFilePaths,
    envName,
    name,
    envFilePaths,
    loadStatement,
    directoryPath,
    packageName,
    preloadFilePaths,
}: LoadStatement) {
    let usesResolvedContexts = false;
    const loadStatements: string[] = [];
    const preloadStatements: string[] = [];
    for (const childEnvName of childEnvs) {
        const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
        if (contextFilePath) {
            usesResolvedContexts = true;
            loadStatements.push(`if (resolvedContexts[${JSON.stringify(envName)}] === ${JSON.stringify(childEnvName)}) {
                ${loadStatement({ moduleIdentifier: name, filePath: contextFilePath, directoryPath, packageName })};
            }`);
        }
        const preloadFilePath = preloadFilePaths[`${envName}/${childEnvName}`];
        if (preloadFilePath) {
            // If a context env has a preload file, it's the same as resolving a context
            usesResolvedContexts = true;
            preloadStatements.push(`if (resolvedContexts[${stringify(envName)}] === ${stringify(childEnvName)}) {
                ${webpackImportStatement({
                    directoryPath,
                    filePath: preloadFilePath,
                    moduleIdentifier: name,
                    packageName,
                })};
            }`);
        }
    }
    const envFilePath = envFilePaths[envName];
    if (envFilePath) {
        loadStatements.push(
            loadStatement({
                moduleIdentifier: `[${envName}]${name}`,
                filePath: envFilePath,
                directoryPath,
                packageName,
            })
        );
    }
    const preloadFilePath = preloadFilePaths[envName];
    if (preloadFilePath) {
        preloadStatements.push(
            webpackImportStatement({
                moduleIdentifier: `[${envName}]${name}`,
                filePath: preloadFilePath,
                directoryPath,
                packageName,
            })
        );
    }
    return { usesResolvedContexts, loadStatements, preloadStatements };
}

function createLoaderInterface(args: WebpackFeatureLoaderArguments) {
    const { name, filePath, dependencies, resolvedContexts, loadStatement, packageName, directoryPath, target } = args;
    const { loadStatements, usesResolvedContexts, preloadStatements } = loadEnvAndContextFiles(args);
    return `{
                async load(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                    ${loadStatements.length ? loadStatements.join(';\n') : ''}
                    const featureModule = ${loadStatement({
                        moduleIdentifier: `[feature]${name}`,
                        filePath,
                        directoryPath,
                        packageName,
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

function loadConfigFile(filePath: string, scopedName: string, configEnvName: string | undefined): string {
    return `import(/* webpackChunkName: "[config]${scopedName}${
        configEnvName ?? ''
    }" */ /* webpackMode: 'eager' */ ${JSON.stringify(
        topLevelConfigLoaderPath + `?scopedName=${scopedName}&envName=${configEnvName!}!` + filePath
    )})`;
}
//#endregion

//#region configs
function fetchConfigs(publicConfigsRoute: string, envName: string) {
    return `config.push(...await (await fetch('${normalizeRoute(
        publicConfigsRoute
    )!}' + configName + '?env=${envName}&feature=' + featureName)).json());`;
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

//#endregion

//#region loading 3rd party features
function loadExternalFeatures(
    target: 'web' | 'webworker' | 'electron-renderer',
    externalFeatures: IExtenalFeatureDescriptor[],
    externalsFilePath?: string
) {
    return `
        self.runtimeFeatureLoader = featureLoader;
        const externalFeatures = ${JSON.stringify(externalFeatures)};
        ${
            externalsFilePath
                ? `externalFeatures.push(...${
                      target === 'electron-renderer'
                          ? fetchFeaturesFromElectronProcess(externalsFilePath)
                          : fetchExternalFeatures(externalsFilePath)
                  })`
                : ''
        };
        if(externalFeatures.length) {
            const entryPaths = externalFeatures.map(({ name, envEntries }) => (envEntries[envName] ? envEntries[envName]['${target}'] : undefined)).filter(Boolean);
            await ${target === 'webworker' ? importScripts() : loadScripts()}(entryPaths);

            for (const { name } of externalFeatures) {
                for (const loadedFeature of await featureLoader.getLoadedFeatures(name)) {
                    features.push(loadedFeature);
                }
            }
        }`;
}

function fetchExternalFeatures(externalFeaturesRoute: string) {
    return `await (await fetch('${normalizeRoute(externalFeaturesRoute)!}')).json()`;
}

function fetchFeaturesFromElectronProcess(externalFeaturesRoute: string) {
    return `await require('electron').ipcRenderer.invoke('${externalFeaturesRoute}')`;
}

function importScripts() {
    return 'importScripts';
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

        return Promise.all(scripts.map(loadScript))
    })`;
}

export function createExternalFeatureMapping(packageName: string, featurePath: string) {
    const externalPath = `${packageName}_${parse(featurePath).name}`;
    return `${LOADED_FEATURE_MODULES_NAMESPACE}[${JSON.stringify(externalPath)}]`;
}

//#endregion

export function remapFileRequest({
    directoryPath,
    filePath,
    packageName,
}: Pick<IFeatureDefinition, 'filePath' | 'directoryPath' | 'packageName'>): string {
    const fileExtname = extname(filePath);
    const remappedFilePath = filePath.replace(directoryPath, packageName).replace(fileExtname, '').replace(/\\/g, '/');
    if (remappedFilePath === filePath) {
        throw new Error(
            'failed to re-map request for external feature while building. maybe caused because of link issues'
        );
    }
    return remappedFilePath;
}

function normalizeRoute(route?: string) {
    if (route && !route.endsWith('/')) {
        return route + '/';
    }

    return route;
}

export function normilizePackageName(packageName: string) {
    return packageName.replace('@', '').replace(/\//g, '').replace(/-/g, '');
}
