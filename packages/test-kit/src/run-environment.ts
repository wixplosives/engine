import { TopLevelConfig, Environment, runEngineApp } from '@wixc3/engine-core';
import { readFeatures, evaluateConfig, createFeatureLoaders } from '@wixc3/engine-scripts';
import { IFileSystem } from '@file-services/types';

export interface IRunNodeEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    basePath?: string;
    env: Environment;
    fs: IFileSystem;
}

export async function runEngineEnvironment({
    featureName,
    configName,
    runtimeOptions = {},
    config = [],
    env,
    basePath = process.cwd(),
    fs,
}: IRunNodeEnvironmentOptions) {
    const { env: name, envType: type } = env;

    const { features, configurations } = await readFeatures(fs, basePath);
    if (configName) {
        config = [...evaluateConfig(configName, configurations, name), ...config];
    }

    const feature = features.get(featureName);
    const childEnvName = feature?.resolvedContexts[name];
    const featureLoaders = createFeatureLoaders(features, {
        name,
        childEnvName,
        type,
    });

    return runEngineApp({
        envName: name,
        featureLoaders,
        config,
        featureName,
        options: new Map(Object.entries(runtimeOptions)),
    });
}
