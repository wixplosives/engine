import { COM, Feature, IFeatureLoader, runEngineApp, RuntimeEngine, FeatureLoadersRegistry } from '@wixc3/engine-core';

import type { IEnvironment, IFeatureDefinition, StartEnvironmentOptions } from './types';

export async function runNodeEnvironment({
    featureName,
    childEnvName,
    features,
    config = [],
    name,
    type,
    options,
    host,
}: StartEnvironmentOptions): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine;
}> {
    if (host) {
        config.push(
            COM.use({
                config: {
                    host,
                    id: name,
                },
            })
        );
    }

    const featureLoaders = createFeatureLoaders(new Map(features), {
        name,
        childEnvName,
        type,
    });
    const rootFeatureLoader = featureLoaders[featureName];
    const { resolvedContexts = {} } = rootFeatureLoader;
    if (!rootFeatureLoader) {
        throw new Error(
            "cannot find feature '" + featureName + "'. available features: " + Object.keys(featureLoaders).join(', ')
        );
    }
    const featureLoader = new FeatureLoadersRegistry(new Map(Object.entries(featureLoaders)), resolvedContexts);
    const optionsRecord: Record<string, string | boolean> = {};

    for (const opt of options || []) {
        optionsRecord[opt[0]] = opt[1];
    }
    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName, optionsRecord);
    return runEngineApp({
        config,
        options: new Map(options),
        envName: name,
        features: loadedFeatures,
        resolvedContexts,
    });
}

export function createFeatureLoaders(
    features: Map<string, IFeatureDefinition>,
    { name: envName, childEnvName }: IEnvironment
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
            preload: async (currentContext, runtimeOptions) => {
                if (childEnvName && currentContext[envName] === childEnvName) {
                    const contextPreloadFilePath = preloadFilePaths[`${envName}/${childEnvName}`];
                    if (contextPreloadFilePath) {
                        const preloadContextModule = (await import(contextPreloadFilePath)) as {
                            init?: (runtimeOptions: Record<string, string | boolean>) => Promise<void>;
                        };
                        if (preloadContextModule.init) {
                            await preloadContextModule.init(runtimeOptions);
                        }
                    }
                }
                const preloadFilePath = preloadFilePaths[envName];
                if (preloadFilePath) {
                    const preloadModule = (await import(preloadFilePath)) as {
                        init?: (runtimeOptions: Record<string, string | boolean>) => Promise<void>;
                    };
                    if (preloadModule.init) {
                        await preloadModule.init(runtimeOptions);
                    }
                }
            },
            load: async (currentContext) => {
                if (childEnvName && currentContext[envName] === childEnvName) {
                    const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
                    if (contextFilePath) {
                        await import(contextFilePath);
                    }
                }

                const envFilePath = envFilePaths[envName];
                if (envFilePath) {
                    await import(envFilePath);
                }
                return ((await import(filePath)) as { default: Feature }).default;
            },
            depFeatures: dependencies,
            resolvedContexts,
        };
    }
    return featureLoaders;
}
