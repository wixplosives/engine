import type { SetMultiMap, TopLevelConfig } from '@wixc3/engine-core';
import { join, parse } from 'path';
import { CONFIG_QUERY_PARAM, FEATURE_QUERY_PARAM } from './build-constants';
import type { IFeatureDefinition, IConfigDefinition } from './types';

const { stringify } = JSON;
const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');

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
    target: 'webworker' | 'web';
}
interface IConfigFileMapping {
    filePath: string;
    configEnvName?: string;
}

export interface WebpackFeatureLoaderArguments extends IFeatureDefinition {
    childEnvs: string[];
    envName: string;
    publicPath?: string;
    loadStatement: (args: LoadStatementArguments) => string;
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
>;

export interface LoadStatementArguments extends Pick<IFeatureDefinition, 'filePath' | 'directoryPath' | 'packageName'> {
    moduleIdentifier: string;
}
//#endregion

//#region entry points

export function createExternalBrowserEntrypoint(args: WebpackFeatureLoaderArguments) {
    return `
    const publicPath = ${
        typeof args.publicPath === 'string' ? JSON.stringify(args.publicPath) : '__webpack_public_path__'
    };
    __webpack_public_path__= publicPath;
    self.runtimeFeatureLoader.register('${args.scopedName}', ${createLoaderInterface(args)});
    ;
    `;
}

export function createExternalNodeEntrypoint(args: WebpackFeatureLoaderArguments) {
    return `
    module.exports = {'${args.scopedName}':  ${createLoaderInterface(args)}};
    ;
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
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), envName);
    return `
import * as EngineCore from '@wixc3/engine-core';

const { getTopWindow, FeatureLoadersRegistry, runEngineApp } = EngineCore;

const featureLoaders = new Map(Object.entries({
    ${createFeatureLoaders(features.values(), envName, childEnvs, target)}
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
    cosnt features = await featureLoader.getLoadedFeatures(featureName))

    const runtimeEngine = runEngineApp(
        { config, options, envName, publicPath, features, resolvedContexts }
    );
    ${loadExternalFeatures(target)}

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

export function nodeImportStatement({ filePath, packageName, directoryPath }: LoadStatementArguments) {
    return `__non_webpack_require__(${stringify(remapFileRequest({ directoryPath, filePath, packageName }))})`;
}

//#endregion

//#region feature loaders generation
function createFeatureLoaders(
    features: Iterable<IFeatureDefinition>,
    envName: string,
    childEnvs: string[],
    target: 'web' | 'webworker' | 'node'
) {
    return Array.from(features)
        .map(
            (args) =>
                `    '${args.scopedName}': ${createLoaderInterface({
                    ...args,
                    envName,
                    childEnvs,
                    loadStatement: target === 'node' ? nodeImportStatement : webpackImportStatement,
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
}: LoadStatement) {
    let usesResolvedContexts = false;
    const loadStatements: string[] = [];
    for (const childEnvName of childEnvs) {
        const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
        if (contextFilePath) {
            usesResolvedContexts = true;
            loadStatements.push(`if (resolvedContexts[${JSON.stringify(envName)}] === ${JSON.stringify(childEnvName)}) {
                ${loadStatement({ moduleIdentifier: name, filePath: contextFilePath, directoryPath, packageName })};
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
    return { usesResolvedContexts, loadStatements };
}

function createLoaderInterface(args: WebpackFeatureLoaderArguments) {
    const { name, filePath, dependencies, resolvedContexts, loadStatement, packageName, directoryPath } = args;
    const { loadStatements, usesResolvedContexts } = loadEnvAndContextFiles(args);
    return `{
                    async load(${usesResolvedContexts ? 'resolvedContexts' : ''}) {
                        ${loadStatements.length ? loadStatements.join('\n') : ''}
                        const featureModule = ${loadStatement({
                            moduleIdentifier: `[feature]${name}`,
                            filePath,
                            directoryPath,
                            packageName,
                        })};
                        self[featureModule.default.id] = featureModule;
                        return featureModule.default;
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
    return `import(/* webpackChunkName: "${filePath}" */ /* webpackMode: 'eager' */ ${JSON.stringify(
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
function loadExternalFeatures(target: 'web' | 'webworker') {
    return `
        self.runtimeFeatureLoader = featureLoader;
        const externalFeatures = ${fetchExternalFeatures('external/')};
        if(externalFeatures.length) {
            if(!self.EngineCore) {
                self.EngineCore = EngineCore;
            }
            const entryPaths = externalFeatures.map(({ name, envEntries }) => (envEntries[envName])).filter(Boolean);
            await ${target === 'web' ? loadScripts() : importScripts()}(entryPaths);

            for (const { name } of externalFeatures) {
                const loadedModules = [];
                for (const loadedFeature of await featureLoader.getLoadedFeatures(name)) {
                    loadedModules.push(loadedFeature);
                    runtimeEngine.engine.initFeature(loadedFeature, envName);
                    runtimeEngine.engine.runFeature(loadedFeature, envName)
                    .catch(err => {
                        for(const module of loadedModules) {
                            runtimeEngine.engine.dispose(module, envName);
                        }
                        console.error(err);
                    });
                }
            }
        }`;
}

function fetchExternalFeatures(externalFeaturesRoute: string) {
    return `await (await fetch('${normalizeRoute(externalFeaturesRoute)!}')).json();`;
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
                document.head.appendChild(script);
            });

        return Promise.all(scripts.map(loadScript))
    })`;
}

//#endregion

export function remapFileRequest({
    directoryPath,
    filePath,
    packageName,
}: Pick<IFeatureDefinition, 'filePath' | 'directoryPath' | 'packageName'>): string {
    const { name, dir } = parse(filePath.replace(directoryPath, packageName));
    return join(dir, name);
}

function normalizeRoute(route?: string) {
    if (route && !route.endsWith('/')) {
        return route + '/';
    }

    return route;
}
