import { readFeatures, evaluateConfig, IExtenalFeatureDescriptor, runNodeEnvironment } from '@wixc3/engine-scripts';
import type { IFileSystem } from '@file-services/types';
import type {
    TopLevelConfig,
    Environment,
    Feature,
    EntityRecord,
    DisposableContext,
    RuntimeEngine,
    MapToProxyType,
} from '@wixc3/engine-core';

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
    return runNodeEnvironment({
        featureName,
        features: [...features.entries()],
        name,
        type,
        childEnvName,
        config,
        externalFeatures,
        options: Object.entries(runtimeOptions),
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
