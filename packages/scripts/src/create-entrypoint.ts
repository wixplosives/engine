import { Environment, TopLevelConfig } from '@wixc3/engine-core';
import { IEnvironmentDescriptor } from '@wixc3/engine-runtime-node';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { SetMultiMap } from '@wixc3/patterns';
import type { IFeatureDefinition } from './types';

const { stringify } = JSON;
const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');

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
    target: 'webworker' | 'web' | 'electron-renderer';
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
    target: 'web' | 'webworker' | 'node' | 'electron-renderer';
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
    config = [],
    target,
    eagerEntrypoint,
    env,
    featuresBundleName,
    configLoaderModuleName = '@wixc3/engine-scripts/dist/default-config-loader',
}: ICreateEntrypointsOptions) {
    const configs = getAllValidConfigurations(getConfigLoaders(configurations, mode, configName), env.name);
    const runningEnv = new Environment(
        env.name,
        env.type,
        env.env.endpointType,
        env.flatDependencies?.map((d) => d.env) ?? []
    );
    const featureLoaders = createFeatureLoaders(
        features.values(),
        childEnvs,
        target,
        env,
        eagerEntrypoint,
        featuresBundleName
    );
    const configLoaders = createConfigLoadersObject(configLoaderModuleName, configs, staticBuild);
    const runtimePublicPath = handlePublicPathTemplate(publicPath, publicPathVariableName);

    return `
import { main } from '@wixc3/engine-core';

const urlParams = new URLSearchParams(globalThis.location.search);
const options = globalThis.engineEntryOptions?.({ urlParams, envName: ${stringify(env.name)} }) ?? urlParams;
const runtimePublicPath = ${runtimePublicPath};

main({
    featureName: ${stringify(featureName)}, 
    configName: ${stringify(configName)},
    env: ${stringify(runningEnv, null, 2)},
    featureLoaders: ${featureLoaders},
    configLoaders: ${configLoaders},
    publicPath: runtimePublicPath,
    publicConfigsRoute: ${stringify(publicConfigsRoute)},
    overrideConfig: ${stringify(config, null, 2)},
    options,
}).catch(console.error);
`;
}

function handlePublicPathTemplate(publicPath: string | undefined, publicPathVariableName: string | undefined) {
    return `(() => {
// TODO: getTopWindow here???
const topWindow = globalThis.parent ?? globalThis;
let publicPath = ${typeof publicPath === 'string' ? stringify(publicPath) : '__webpack_public_path__'}
if (options.has('publicPath')) {
    publicPath = options.get('publicPath');
} else if (${typeof publicPathVariableName === 'string'} && topWindow[${stringify(publicPathVariableName)}]) {
    publicPath = topWindow[${stringify(publicPathVariableName)}];
}
__webpack_public_path__= publicPath;
return publicPath;
})()`;
}

//#endregion

//#region import statements templates
export function dynamicImportStatement({ moduleIdentifier, filePath, eagerEntrypoint }: LoadStatementArguments) {
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
    target: 'web' | 'webworker' | 'node' | 'electron-renderer',
    env: IEnvironmentDescriptor,
    eagerEntrypoint?: boolean,
    featuresBundleName?: string
) {
    return `new Map(Object.entries({\n${Array.from(features)
        .map(
            (args) =>
                `    '${args.scopedName}': ${createLoaderInterface({
                    ...args,
                    childEnvs,
                    loadStatement: dynamicImportStatement,
                    target,
                    eagerEntrypoint,
                    env,
                    featuresBundleName,
                })}`
        )
        .join(',\n')}\n}))`;
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
                ${dynamicImportStatement({
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
            dynamicImportStatement({
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
    for (const [configName, { filePath, envName: configEnvName }] of configurations) {
        configNameToFiles[configName] ??= [];
        if (!configEnvName || configEnvName === envName) {
            configNameToFiles[configName]!.push({ filePath, configEnvName });
        }
    }
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

function createConfigLoadersObject(
    configLoaderModuleName: string,
    configs: Record<string, IConfigFileMapping[]>,
    staticBuild: boolean
) {
    const loaders: string[] = [];
    if (staticBuild) {
        for (const [scopedName, availableConfigs] of Object.entries(configs)) {
            const loadStatements = availableConfigs.map(({ filePath, configEnvName }) =>
                loadConfigFileTemplate(configLoaderModuleName, filePath, scopedName, configEnvName)
            );
            loaders.push(`    '${scopedName}': async () => (await Promise.all([${loadStatements.join(',')}]))`);
        }
    }
    return `{\n${loaders.join(',\n')}\n}`;
}

function loadConfigFileTemplate(
    configLoaderModuleName: string,
    filePath: string,
    scopedName: string,
    configEnvName = ''
): string {
    const request = stringify(
        topLevelConfigLoaderPath +
            `?configLoaderModuleName=${configLoaderModuleName}&scopedName=${scopedName}&envName=${configEnvName}!` +
            filePath
    );
    return `import(/* webpackChunkName: "[config]${scopedName}${configEnvName}" */ /* webpackMode: 'eager' */ ${request})`;
}
//#endregion

export function normilizePackageName(packageName: string) {
    return packageName.replace('@', '').replace(/\//g, '').replace(/-/g, '');
}
