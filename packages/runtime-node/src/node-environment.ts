import {
    AnyEnvironment,
    COM,
    Feature,
    FeatureLoadersRegistry,
    IFeatureLoader,
    IPreloadModule,
    runEngineApp,
    RuntimeEngine,
    RuntimeMetadata,
} from '@wixc3/engine-core';
import type { IEnvironmentDescriptor, StartEnvironmentOptions } from '@wixc3/engine-core-node';

import type { IStaticFeatureDefinition } from './types';

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
    env,
}: StartEnvironmentOptions<ENV>): Promise<{
    dispose: () => Promise<void>;
    engine: RuntimeEngine<ENV>;
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

    config.push(
        RuntimeMetadata.use({
            engineerMetadataConfig: {
                applicationPath: bundlePath,
            },
        })
    );

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

    const runtimeEngine = runEngineApp({
        config,
        options: new Map(options),
        features: runningFeatures,
        resolvedContexts,
        env,
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
