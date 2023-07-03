import {
    AnyEnvironment,
    COM,
    FeatureClass,
    FeatureLoadersRegistry,
    IFeatureLoader,
    IPreloadModule,
    RuntimeEngine,
    RuntimeMetadata,
} from '@wixc3/engine-core';
import type { IStaticFeatureDefinition, IEnvironmentDescriptor, StartEnvironmentOptions } from './types';

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
}: StartEnvironmentOptions<ENV>): Promise<RuntimeEngine<ENV>> {
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

    const engine = new RuntimeEngine(
        env,
        [
            COM.use({
                config: {
                    resolvedContexts,
                },
            }),
            ...config,
        ],
        new Map(options)
    );
    // we don't wait here because the process of node environment manager prepare environment is two step process
    void engine.run(runningFeatures);
    return engine;
}

export function createFeatureLoaders(
    features: Map<string, IStaticFeatureDefinition>,
    { childEnvName, env }: IEnvironmentDescriptor
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
                if (childEnvName && currentContext[env.env] === childEnvName) {
                    const contextPreloadFilePath = preloadFilePaths[`${env.env}/${childEnvName}`];

                    if (contextPreloadFilePath) {
                        const preloadedContextModule = (await import(contextPreloadFilePath)) as IPreloadModule;
                        if (preloadedContextModule.init) {
                            initFunctions.push(preloadedContextModule.init);
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
            load: async (currentContext) => {
                if (childEnvName && currentContext[env.env] === childEnvName) {
                    const contextFilePath = contextFilePaths[`${env.env}/${childEnvName}`];
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
                return ((await import(filePath)) as { default: FeatureClass }).default;
            },
            depFeatures: dependencies,
            resolvedContexts,
        };
    }
    return featureLoaders;
}
