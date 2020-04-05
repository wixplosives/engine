import { COM, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';

import { IEnvironment, IFeatureDefinition, StartEnvironmentOptions } from './types';

export async function runEnvironment({
    featureName,
    childEnvName,
    features,
    config = [],
    name,
    type,
    options,
    host,
}: StartEnvironmentOptions) {
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
    const disposeHandlers = new Set<() => unknown>();

    const runningEngine = await runEngineApp({
        featureName,
        featureLoaders: createFeatureLoaders(new Map(features), {
            name,
            childEnvName,
            type,
        }),
        config,
        options: new Map(options),
        envName: name,
    });
    disposeHandlers.add(() => runningEngine.dispose());

    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        },
    };
}

function createFeatureLoaders(
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
                return (await import(filePath)).default;
            },
            depFeatures: dependencies,
            resolvedContexts,
        };
    }
    return featureLoaders;
}
