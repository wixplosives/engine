import {
    TopLevelConfig,
    Environment,
    runEngineApp,
    Feature,
    RuntimeEngine,
    EntityRecord,
    DisposableContext,
    MapToProxyType,
    FeatureLoadersRegistry,
    IFeatureLoader,
} from '@wixc3/engine-core';
import { readFeatures, evaluateConfig, createFeatureLoaders, IExtenalFeatureDescriptor } from '@wixc3/engine-scripts';
import type { IFileSystem } from '@file-services/types';

export interface IRunNodeEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    basePath?: string;
    env: Environment;
    fs: IFileSystem;
    externalFeatures?: IExtenalFeatureDescriptor[];
}

export interface IGetRuinnnigFeatureOptions<
    NAME extends string,
    DEPS extends Feature[],
    API extends EntityRecord,
    CONTEXT extends Record<string, DisposableContext<any>>
> extends IRunNodeEnvironmentOptions {
    feature: Feature<NAME, DEPS, API, CONTEXT>;
}

export async function runEngineEnvironment({
    featureName,
    configName,
    runtimeOptions = {},
    config = [],
    env,
    basePath = process.cwd(),
    fs,
    externalFeatures = [],
}: IRunNodeEnvironmentOptions): Promise<{
    engine: RuntimeEngine;
    dispose: () => Promise<void>;
}> {
    const { env: name, envType: type } = env;
    const { features, configurations } = readFeatures(fs, basePath);

    if (configName) {
        config = [...evaluateConfig(configName, configurations, name), ...config];
    }

    const featureDef = features.get(featureName);
    const childEnvName = featureDef?.resolvedContexts[name];
    const featureLoaders = createFeatureLoaders(features, {
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
    for (const { name, envEntries } of externalFeatures) {
        if (envEntries[name]) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const externalFeatureLoaders = require(envEntries[name]) as { [featureName: string]: IFeatureLoader };

            for (const [name, loader] of Object.entries(externalFeatureLoaders)) {
                featureLoader.register(name, loader);
            }
        }
        for (const feature of await featureLoader.getLoadedFeatures(name)) {
            runningFeatures.push(feature);
        }
    }
    return runEngineApp({
        config,
        options: new Map(Object.entries(runtimeOptions)),
        envName: name,
        features: runningFeatures,
        resolvedContexts,
    });
}

export async function getRunningFeature<
    NAME extends string,
    DEPS extends Feature[],
    API extends EntityRecord,
    CONTEXT extends Record<string, DisposableContext<any>>
>({
    featureName,
    configName,
    runtimeOptions = {},
    config = [],
    env,
    basePath = process.cwd(),
    fs,
    feature,
    externalFeatures,
}: IGetRuinnnigFeatureOptions<NAME, DEPS, API, CONTEXT>): Promise<{
    dispose: () => Promise<void>;
    runningApi: MapToProxyType<API>;
    engine: RuntimeEngine;
}> {
    const { engine, dispose } = await runEngineEnvironment({
        featureName,
        config,
        configName,
        env,
        runtimeOptions,
        fs,
        basePath,
        externalFeatures,
    });
    const { api } = engine.get(feature);
    return {
        runningApi: api,
        engine,
        dispose,
    };
}
