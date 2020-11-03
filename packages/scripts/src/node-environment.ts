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
    externalFeatures = [],
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
    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName);
    const runningFeatures = [loadedFeatures[loadedFeatures.length - 1]];

    for (const { name: externalFeatureName, envEntries } of externalFeatures) {
        if (envEntries[name]) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const externalFeatureLoaders = require(envEntries[name]) as { [featureName: string]: IFeatureLoader };

            for (const [name, loader] of Object.entries(externalFeatureLoaders)) {
                featureLoader.register(name, loader);
            }
        }
        for (const feature of await featureLoader.getLoadedFeatures(externalFeatureName)) {
            runningFeatures.push(feature);
        }
    }
    const runtimeEngine = runEngineApp({
        config,
        options: new Map(options),
        envName: name,
        features: runningFeatures,
        resolvedContexts,
    });

    return runtimeEngine;
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
    } of features.values()) {
        featureLoaders[scopedName] = {
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
