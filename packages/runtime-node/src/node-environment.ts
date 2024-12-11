import { pathToFileURL } from 'node:url';
import {
    COM,
    FeatureLoadersRegistry,
    RuntimeEngine,
    type AnyEnvironment,
    type FeatureClass,
    type IFeatureLoader,
    type IPreloadModule,
} from '@wixc3/engine-core';
import type { IEnvironmentDescriptor, IStaticFeatureDefinition, StartEnvironmentOptions } from './types.js';

export async function runNodeEnvironment<ENV extends AnyEnvironment>({
    featureName,
    childEnvName,
    features,
    config = [],
    name,
    type,
    options,
    host,
    env,
}: StartEnvironmentOptions<ENV>): Promise<RuntimeEngine<ENV>> {
    if (host) {
        config.push(
            COM.configure({
                config: {
                    host,
                    id: name,
                },
            }),
        );
    }

    const featureLoaders = createFeatureLoaders(new Map(features), {
        name,
        childEnvName,
        type,
        env,
    });

    const featureLoader = new FeatureLoadersRegistry(new Map(Object.entries(featureLoaders)));
    const { entryFeature, resolvedContexts } = await featureLoader.loadEntryFeature(
        featureName,
        Object.fromEntries(options || []),
    );

    const engine = new RuntimeEngine(
        env,
        [
            COM.configure({
                config: {
                    resolvedContexts,
                },
            }),
            ...config,
        ],
        new Map(options),
    );
    // we don't wait here because the process of node environment manager prepare environment is two step process
    void engine.run(entryFeature);
    return engine;
}

export function createFeatureLoaders(
    features: Map<string, IStaticFeatureDefinition>,
    { childEnvName, env }: IEnvironmentDescriptor,
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
                        const preloadedContextModule = (await import(
                            pathToFileURL(contextPreloadFilePath).href
                        )) as IPreloadModule;
                        if (preloadedContextModule.init) {
                            initFunctions.push(preloadedContextModule.init);
                        }
                    }
                }
                const preloadFilePath = preloadFilePaths[env.env];
                if (preloadFilePath) {
                    const preloadedModule = (await import(pathToFileURL(preloadFilePath).href)) as IPreloadModule;
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
                        await import(pathToFileURL(contextFilePath).href);
                    }
                }
                for (const { env: envName } of new Set([env, ...env.dependencies])) {
                    const envFilePath = envFilePaths[envName];
                    if (envFilePath) {
                        await import(pathToFileURL(envFilePath).href);
                    }
                }
                return ((await import(pathToFileURL(filePath).href)) as { default: FeatureClass }).default;
            },
            depFeatures: dependencies,
            resolvedContexts,
        };
    }
    return featureLoaders;
}
