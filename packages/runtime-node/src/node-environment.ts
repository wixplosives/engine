import {
    COM,
    Feature,
    IFeatureLoader,
    runEngineApp,
    RuntimeEngine,
    RuntimeMetadata,
    FeatureLoadersRegistry,
    IPreloadModule,
    AnyEnvironment,
} from '@wixc3/engine-core';
import { init, remapToUserLibrary, clear } from './external-request-mapper';

import type { IEnvironmentDescriptor, StartEnvironmentOptions, IStaticFeatureDefinition } from './types';

export async function runNodeEnvironment<ENV extends AnyEnvironment>({
    featureName,
    childEnvName,
    features,
    bundlePath,
    config = [],
    name,
    type,
    options,
    host,
    externalFeatures = [],
    context,
    env,
}: StartEnvironmentOptions<ENV>): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine<ENV>;
}> {
    const featureLoaders = createFeatureLoaders(new Map(features), {
        name,
        childEnvName,
        type,
        env,
    });
    const rootFeatureLoader = featureLoaders[featureName];
    if (!rootFeatureLoader) {
        throw new Error(
            "cannot find feature '" + featureName + "'. available features: " + Object.keys(featureLoaders).join(', ')
        );
    }
    const { resolvedContexts = {} } = rootFeatureLoader;

    const featureLoader = new FeatureLoadersRegistry(new Map(Object.entries(featureLoaders)), resolvedContexts);
    const optionsRecord: Record<string, string | boolean> = {};

    for (const [key, val] of options || []) {
        optionsRecord[key] = val;
    }
    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName, optionsRecord);
    const runningFeatures = [loadedFeatures[loadedFeatures.length - 1]!];

    // if context is not provided, environment will not load external features
    if (context) {
        // mapping all found feature file requests to the current running context, so that external features, when importing feature files, will evaluate the files under the current context
        [...features.values()].map(([, { packageName }]) =>
            remapToUserLibrary({
                test: (request) => request.includes(packageName),
                context,
            })
        );

        // mapping all features to be evaluated from the context of their package location
        externalFeatures.map(({ packageName, packageBasePath }) =>
            remapToUserLibrary({
                test: (request) => request.includes(packageName),
                context: packageBasePath,
            })
        );
        // initializing our module system tricks to be able to load all features from their proper context, so that features will not be loaded twice
        init();
    }

    for (const { scopedName: externalFeatureName, envEntries } of externalFeatures) {
        if (envEntries[name] && envEntries[name]!['node']) {
            const externalFeatureLoaders = (await import(envEntries[name]!['node']!)) as {
                [featureName: string]: IFeatureLoader;
            };
            for (const [name, loader] of Object.entries(externalFeatureLoaders)) {
                featureLoader.register(name, loader);
            }
            for (const feature of await featureLoader.getLoadedFeatures(externalFeatureName, optionsRecord)) {
                runningFeatures.push(feature);
            }
        }
    }
    if (context) {
        clear();
    }

    if (host) {
        config.push(
            COM.use({
                config: {
                    resolvedContexts,
                    host,
                    id: name,
                },
            })
        );
    }

    config.push(
        RuntimeMetadata.use({
            runtimeMetadataConfig: {
                applicationPath: bundlePath,
            },
        })
    );

    const runtimeEngine = runEngineApp({
        env,
        config,
        options: new Map(options),
        features: runningFeatures,
    });

    return runtimeEngine;
}

export function createFeatureLoaders(
    features: Map<string, Required<IStaticFeatureDefinition>>,
    { childEnvName, name: envName, env }: IEnvironmentDescriptor
) {
    const featureLoaders: Record<string, IFeatureLoader> = {};
    for (const {
        scopedName,
        filePath,
        dependencies,
        envFilePaths,
        contextFilePaths,
        resolvedContexts,
        preloadFilePaths,
    } of features.values()) {
        featureLoaders[scopedName] = {
            preload: async (currentContext) => {
                const initFunctions = [];
                if (childEnvName && currentContext[envName] === childEnvName) {
                    const contextPreloadFilePath = preloadFilePaths[`${envName}/${childEnvName}`];

                    if (contextPreloadFilePath) {
                        const preloadedContextModule = (await import(contextPreloadFilePath)) as IPreloadModule;
                        if (preloadedContextModule.init) {
                            initFunctions.push(preloadedContextModule.init);
                        }
                    }
                }
                const preloadFilePath = preloadFilePaths[envName];
                if (preloadFilePath) {
                    const preloadedModule = (await import(preloadFilePath)) as IPreloadModule;
                    if (preloadedModule.init) {
                        initFunctions.push(preloadedModule.init);
                    }
                }
                return initFunctions;
            },
            load: async (currentContext) => {
                if (childEnvName && currentContext[envName] === childEnvName) {
                    const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
                    if (contextFilePath) {
                        await import(contextFilePath);
                    }
                }
                for (const { env: envName } of new Set([env, ...env.dependencies])) {
                    const envFilePath = envFilePaths[envName];
                    if (envFilePath) {
                        await import(envFilePath);
                    }
                }
                return ((await import(filePath)) as { default: Feature }).default;
            },
            depFeatures: dependencies,
            resolvedContexts,
        };
    }
    return featureLoaders;
}
