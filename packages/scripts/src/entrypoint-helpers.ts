import {
    Environment,
    Feature,
    FeatureLoadersRegistry,
    IFeatureLoader,
    IPreloadModule,
    SetMultiMap,
    TopLevelConfig,
} from '@wixc3/engine-core';
import type { IConfigDefinition, IExternalFeatureNodeDescriptor } from '@wixc3/engine-runtime-node';
import { parse } from 'path';
import type { IFeatureDefinition } from './types';

export interface ICreateEntrypointsOptions {
    features: ReadonlyMap<string, IFeatureDefinition>;
    env: Environment;
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
}

export interface ExternalEntrypoint extends IFeatureDefinition {
    childEnvs: string[];
    publicPath?: string;
    env: Environment;
}

interface TopLevelConfigModule {
    default: TopLevelConfig;
}

interface IConfigFileMapping {
    filePath: string;
    configEnvName?: string;
}

const topLevelConfigLoaderPath = require.resolve('./top-level-config-loader');

export interface WebpackFeatureLoaderArguments extends ExternalEntrypoint {
    target: 'web' | 'webworker' | 'node' | 'electron-renderer';
    eagerEntrypoint?: boolean;
    loadStatement: (args: LoadStatementArguments) => string;
}

export type LoadStatement = Pick<
    WebpackFeatureLoaderArguments,
    | 'childEnvs'
    | 'contextFilePaths'
    | 'envFilePaths'
    | 'name'
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

export interface ICreateFeatureLoaders {
    features: Iterable<IFeatureDefinition>;
    env: Environment;
    childEnvs: string[];
    eagerEntrypoint?: boolean;
    target: 'web' | 'webworker' | 'node' | 'electron-renderer';
    loadStatement: (args: LoadStatementArguments) => string;
}

export function webImportStatement({ moduleIdentifier, eagerEntrypoint, filePath }: LoadStatementArguments) {
    const statement = [`/* webpackChunkName:${moduleIdentifier} */`];
    if (eagerEntrypoint) {
        statement.push(`/* webpackMode: 'eager' */`);
    }
    statement.push(filePath);
    return statement.join(' ');
}

export function nodeImportStatement({ filePath }: Pick<LoadStatementArguments, 'filePath'>) {
    return `require(${JSON.stringify(filePath)})`;
}

export function registerExternalFeature(args: WebpackFeatureLoaderArguments) {
    window.runtimeFeatureLoader?.register(args.scopedName, createFeatureLoaderObject(args));
}

export function createFeatureLoaders({ features, ...rest }: ICreateFeatureLoaders) {
    return new Map(
        [...features].reduce((acc, featureLoader) => {
            acc.push([
                featureLoader.scopedName,
                createFeatureLoaderObject({
                    ...featureLoader,
                    ...rest,
                }),
            ]);

            return acc;
        }, [] as [string, IFeatureLoader][])
    );
}

export type ConfigLoaders = Record<string, () => Promise<TopLevelConfigModule[]>>;

export function createFeatureLoaderObject({
    dependencies,
    resolvedContexts,
    childEnvs,
    contextFilePaths,
    env,
    directoryPath,
    filePath,
    name,
    packageName,
    eagerEntrypoint,
    envFilePaths,
    preloadFilePaths,
    loadStatement,
}: WebpackFeatureLoaderArguments): IFeatureLoader {
    return {
        depFeatures: dependencies,
        resolvedContexts,
        load: async (resolvedContexts = {}) => {
            for (const childEnvName of childEnvs) {
                const contextFilePath = contextFilePaths[`${env.env}/${childEnvName}`];
                if (contextFilePath && resolvedContexts[env.env] === childEnvName) {
                    await import(
                        loadStatement({
                            directoryPath,
                            filePath,
                            moduleIdentifier: name,
                            packageName,
                            eagerEntrypoint,
                        })
                    );
                }
            }

            for (const { env: envName } of [env, ...env.dependencies]) {
                const envFilePath = envFilePaths?.[envName];
                if (envFilePath) {
                    await import(
                        loadStatement({
                            directoryPath,
                            filePath,
                            moduleIdentifier: `[${envName}]${name}`,
                            packageName,
                            eagerEntrypoint,
                        })
                    );
                }
            }

            const featureModule = (await import(
                loadStatement({
                    directoryPath,
                    filePath,
                    packageName,
                    eagerEntrypoint,
                    moduleIdentifier: `[feature]${name}`,
                })
            )) as { default: Feature };

            // external feature mapping
            self._engine_[createExternalFeatureMapping(packageName, filePath)] = featureModule;

            return featureModule.default;
        },
        preload: async (currentContext) => {
            const initFunctions = [];
            for (const childEnvName of childEnvs) {
                if (childEnvName && currentContext[env.env] === childEnvName) {
                    const contextPreloadFilePath = preloadFilePaths[`${env.env}/${childEnvName}`];

                    if (contextPreloadFilePath) {
                        const preloadedContextModule = (await import(contextPreloadFilePath)) as IPreloadModule;
                        if (preloadedContextModule.init) {
                            initFunctions.push(preloadedContextModule.init);
                        }
                    }
                }
            }
            const preloadFilePath = preloadFilePaths[env.env];
            if (preloadFilePath) {
                const preloadedModule = (await import(preloadFilePath)) as IPreloadModule;
                if (preloadedModule.init) {
                    initFunctions.push(preloadedModule.init);
                }
            }
            return initFunctions;
        },
    };
}

export function createConfigLoaders(configs: Record<string, IConfigFileMapping[]>) {
    return Object.entries(configs).reduce((acc, [scopedName, config]) => {
        const importedConfigPaths = config?.map(({ filePath, configEnvName }) =>
            loadConfigFile(filePath, scopedName, configEnvName)
        );
        acc[scopedName] = () => Promise.all(importedConfigPaths);
        return acc;
    }, {} as ConfigLoaders);
}

function loadConfigFile(
    filePath: string,
    scopedName: string,
    configEnvName: string | undefined
): Promise<TopLevelConfigModule> {
    return import(
        webImportStatement({
            moduleIdentifier: `[config]${scopedName}${configEnvName ?? ''}`,
            directoryPath: '',
            filePath: topLevelConfigLoaderPath + `?scopedName=${scopedName}&envName=${configEnvName!}!` + filePath,
            packageName: '',
            eagerEntrypoint: true,
        })
    ) as unknown as Promise<TopLevelConfigModule>;
}

export async function importStaticConfigs(configLoaders: ConfigLoaders, configName: string, config: TopLevelConfig) {
    const currentConfigLoaders = configLoaders[configName];
    if (configName && currentConfigLoaders) {
        const loadedConfigurations = (await currentConfigLoaders()).map((module) => module.default);
        config.push(...loadedConfigurations.flat());
    }
}

export function addOverrideConfig(overrideConfig: TopLevelConfig, config: TopLevelConfig) {
    return config.push(...overrideConfig);
}

export async function fetchConfigs(
    publicConfigsRoute: string,
    envName: string,
    configName: string,
    featureName: string
): Promise<TopLevelConfig> {
    const url = new URL(normalizeRoute(publicConfigsRoute) + configName);
    url.searchParams.append('env', envName);
    url.searchParams.append('feature', featureName);
    return (await fetch(url.toString())).json() as unknown as TopLevelConfig;
}

export function getConfigsFromParent(
    publicConfigsRoute: string,
    envName: string,
    currentWindow: typeof window,
    topWindow = currentWindow
): Promise<TopLevelConfig> {
    return new Promise((res) => {
        const configsHandler = ({ data: { id, config } }: { data: { id: string; config: TopLevelConfig } }) => {
            if (id === publicConfigsRoute) {
                currentWindow.removeEventListener('message', configsHandler);
                res(config);
            }
        };
        currentWindow.addEventListener('message', configsHandler);
        topWindow.postMessage({
            id: publicConfigsRoute,
            envName,
        });
    });
}

export async function getRemoteConfigs(
    publicConfigsRoute: string,
    envName: string,
    config: TopLevelConfig,
    configName: string,
    featureName: string,
    currentWindow: typeof window,
    topWindow = currentWindow,
    isMainEntrypoint: boolean
) {
    config.push(
        ...(await (isMainEntrypoint
            ? fetchConfigs(publicConfigsRoute, envName, configName, featureName)
            : getConfigsFromParent(publicConfigsRoute, envName, currentWindow, topWindow)))
    );
}

export function addConfigsEventListenerForParentEnvironments(
    publicConfigsRoute: string,
    currentWindow: typeof window,
    isMainEntrypoint: boolean,
    configName: string,
    featureName: string,
    fetchedConfigs: Record<string, TopLevelConfig> = {}
) {
    if (isMainEntrypoint) {
        const configsEventListener: (args: {
            data: { id: string; envName: string };
            source: MessageEventSource | null;
        }) => Promise<void> = async ({ data: { id, envName }, source }) => {
            if (source && id === publicConfigsRoute) {
                if (!fetchedConfigs[envName]) {
                    const config = await fetchConfigs(publicConfigsRoute, envName, configName, featureName);
                    fetchedConfigs[envName] = config;
                }
                source.postMessage({
                    id,
                    config: fetchedConfigs[envName],
                });
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        currentWindow.addEventListener('message', configsEventListener);
    }
}

function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}

export const getAllValidConfigurations = (configurations: [string, IConfigDefinition][], envName: string) => {
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

export const getConfigLoaders = (
    configurations: SetMultiMap<string, IConfigDefinition>,
    mode: 'development' | 'production',
    configName?: string
) => {
    if (mode === 'production' && configName) {
        return [...configurations.entries()].filter(([scopedConfigName]) => scopedConfigName === configName);
    }
    return [...configurations.entries()];
};

//#endregion

export function createExternalFeatureMapping(packageName: string, featurePath: string) {
    return `${packageName}_${parse(featurePath).name}`;
}

interface LoadExternalFeaturesArguments {
    featureLoader: FeatureLoadersRegistry;
    isMainEntrypoint: boolean;
    currentWindow: typeof window;
    externalsFilePath: string;
    externalFeatures: IExternalFeatureNodeDescriptor[];
    target: string;
    envName: string;
    publicPath: string;
    externalFeaturesFetcher: (path: string, publicPath: string) => Promise<IExternalFeatureNodeDescriptor[]>;
    externalFeaturesLoader: (entryPaths: string[]) => Promise<void>;
}

export async function loadExternalFeatures({
    featureLoader,
    isMainEntrypoint,
    currentWindow,
    externalsFilePath,
    externalFeatures,
    target,
    envName,
    externalFeaturesFetcher,
    externalFeaturesLoader,
    publicPath,
}: LoadExternalFeaturesArguments): Promise<Feature[]> {
    self.runtimeFeatureLoader = featureLoader;
    const features: Feature[] = [];
    if (isMainEntrypoint) {
        const externalFeaturesListener: (args: { data: { id: string }; source: MessageEventSource | null }) => void = ({
            data: { id },
            source,
        }): void => {
            if (source && id === externalsFilePath) {
                source.postMessage({
                    id,
                    externalFeatures,
                });
            }
        };
        currentWindow.addEventListener('message', externalFeaturesListener);
    }

    const fetchedExternalFeatures = await externalFeaturesFetcher(externalsFilePath, publicPath);

    externalFeatures.push(...fetchedExternalFeatures);
    window.externalFeatures = externalFeatures;
    if (externalFeatures.length) {
        const filteredExternals = externalFeatures.filter(
            ({ envEntries }) => envEntries[envName] && envEntries[envName]?.[target]
        );
        const entryPaths = filteredExternals.map<string>(({ envEntries }) => envEntries[envName]![target]!);
        if (filteredExternals.length) {
            await externalFeaturesLoader(entryPaths);
            for (const { scopedName } of filteredExternals) {
                for (const loadedFeature of await featureLoader.getLoadedFeatures(scopedName)) {
                    features.push(loadedFeature);
                }
            }
        }
    }
    return features;
}

export async function loadRootFeature(featureLoaders: ReturnType<typeof createFeatureLoaders>, featureName: string) {
    const rootFeatureLoader = featureLoaders.get(featureName);
    if (!rootFeatureLoader) {
        throw new Error(
            "cannot find feature '" +
                featureName +
                "'. available features:\\n" +
                Array.from(featureLoaders.keys()).join('\\n')
        );
    }
    const { resolvedContexts = {} } = rootFeatureLoader;
    const featureLoader = new FeatureLoadersRegistry(featureLoaders, resolvedContexts);

    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName);

    return { featureLoader, feature: loadedFeatures[loadedFeatures.length - 1], resolvedContexts };
}

export function getExternalPublicPath(envName: string, target: string, featureName: string, topWindow: typeof window) {
    const featureDef = topWindow.externalFeatures.find(({ scopedName }) => scopedName === featureName);
    if (!featureDef) {
        throw new Error('trying to load feature ' + featureName + ', but it is not defined');
    }
    const curerntUrl = featureDef.envEntries[envName]![target]!;
    const publicPath = curerntUrl.substring(0, curerntUrl.lastIndexOf('/') + 1);
    return publicPath;
}
