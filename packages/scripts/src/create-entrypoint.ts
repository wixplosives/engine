import { TopLevelConfig } from '@wixc3/engine-core';
import type { ConfigurationEnvironmentMapping, IEnvironmentDescriptor } from '@wixc3/engine-runtime-node';
import type { IConfigDefinition } from '@wixc3/engine-runtime-node';
import type { SetMultiMap } from '@wixc3/patterns';
import type { IFeatureDefinition } from './types';
import { relative } from 'path';

const { stringify } = JSON;

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

//#region import statements templates
export function dynamicImportStatement({
    moduleIdentifier,
    filePath,
    eagerEntrypoint,
    directoryPath,
    packageName,
}: LoadStatementArguments) {
    const targetSpecifier = packageName + '/' + relative(directoryPath, filePath).replace(/\\/g, '/');
    return `await import(/* webpackChunkName: "${moduleIdentifier}" */${
        eagerEntrypoint ? ` /* webpackMode: 'eager' */` : ''
    } ${stringify(targetSpecifier)});`;
}

//#endregion

//#region feature loaders generation
export function createFeatureLoaders(
    features: Iterable<IFeatureDefinition>,
    childEnvs: string[],
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
    const configNameToFiles: Record<string, { filePath: string; configEnvName: string | undefined }[]> = {};
    for (const [configName, { filePath, envName: configEnvName }] of configurations) {
        configNameToFiles[configName] ??= [];
        if (!configEnvName || configEnvName === envName) {
            configNameToFiles[configName]!.push({ filePath, configEnvName });
        }
    }
    return configNameToFiles;
};

export const createAllValidConfigurationsEnvironmentMapping = (
    configurations: SetMultiMap<string, IConfigDefinition>,
    mode: 'development' | 'production',
    configName?: string
) => {
    const configurationMapping: ConfigurationEnvironmentMapping = {};
    const configEntries = filterConfigurationsByMode(configurations, mode, configName);
    for (const [name, { filePath, envName: configEnvName }] of configEntries) {
        configurationMapping[name] ??= {
            byEnv: {},
            common: [],
        };
        if (!configEnvName) {
            configurationMapping[name]!.common.push({ filePath });
        } else {
            configurationMapping[name]!.byEnv[configEnvName] ??= [];
            configurationMapping[name]!.byEnv[configEnvName]!.push({ filePath });
        }
    }
    return configurationMapping;
};

const filterConfigurationsByMode = (
    configurations: SetMultiMap<string, IConfigDefinition>,
    mode: 'development' | 'production',
    configName?: string
) => {
    if (mode === 'production' && configName) {
        return [...configurations.entries()].filter(([scopedConfigName]) => scopedConfigName === configName);
    }
    return [...configurations.entries()];
};

export function createConfigLoaders({
    configurations,
    mode,
    configName,
    envName,
    staticBuild,
    loadConfigFileTemplate,
}: {
    configurations: SetMultiMap<string, IConfigDefinition>;
    mode: 'development' | 'production';
    configName: string | undefined;
    envName: string;
    staticBuild: boolean;
    loadConfigFileTemplate: (filePath: string, scopedName: string, configEnvName?: string) => string;
}) {
    const configs = getAllValidConfigurations(filterConfigurationsByMode(configurations, mode, configName), envName);
    const loaders: string[] = [];
    if (staticBuild) {
        for (const [scopedName, availableConfigs] of Object.entries(configs)) {
            const loadStatements = availableConfigs.map(({ filePath, configEnvName }) =>
                loadConfigFileTemplate(filePath, scopedName, configEnvName)
            );
            loaders.push(`    '${scopedName}': async () => (await Promise.all([${loadStatements.join(',')}]))`);
        }
    }
    return `{\n${loaders.join(',\n')}\n}`;
}

//#endregion
