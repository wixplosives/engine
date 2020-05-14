import { TopLevelConfig, Environment } from '@wixc3/engine-core';
import { readFeatures, evaluateConfig, runNodeEnvironment as launch } from '@wixc3/engine-scripts';
import { IFileSystem } from '@file-services/types';

interface IRuntimeEnvironment extends Environment {
    childEnvName?: string;
}

export interface IRunNodeEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    basePath?: string;
    env: IRuntimeEnvironment;
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
    const { env: name, envType: type, childEnvName } = env;

    const { features, configurations } = await readFeatures(fs, basePath);
    if (configName) {
        config = [...evaluateConfig(configName, configurations, name), ...config];
    }

    return launch({
        featureName,
        features: [...features],
        config,
        name,
        type,
        options: Object.entries(runtimeOptions),
        childEnvName,
    });
}
