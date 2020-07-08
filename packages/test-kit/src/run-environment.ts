import {
    TopLevelConfig,
    Environment,
    runEngineApp,
    Feature,
    RuntimeEngine,
    EntityRecord,
    DisposableContext,
    MapToProxyType,
} from '@wixc3/engine-core';
import { readFeatures, evaluateConfig, createFeatureLoaders } from '@wixc3/engine-scripts';
import type { IFileSystem } from '@file-services/types';

export interface IRunNodeEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    basePath?: string;
    env: Environment;
    fs: IFileSystem;
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

    return await runEngineApp({
        envName: name,
        featureLoaders,
        config,
        featureName,
        options: new Map(Object.entries(runtimeOptions)),
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
    });
    const { api } = engine.get(feature);
    return {
        runningApi: api,
        engine,
        dispose,
    };
}
