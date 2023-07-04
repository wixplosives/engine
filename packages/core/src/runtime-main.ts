import type { IRunOptions, TopLevelConfig } from './types';
import type { AnyEnvironment } from './entities';
import { FeatureLoadersRegistry, IFeatureLoader } from './run-engine-app';
import { ConfigLoaders, RuntimeConfigurations } from './runtime-configurations';
import { RuntimeEngine } from './runtime-engine';
import { INSTANCE_ID_PARAM_NAME } from './com';
import COM from './communication.feature';

export interface MainEntryParams {
    env: AnyEnvironment;
    overrideConfig: TopLevelConfig;
    featureLoaders: Map<string, IFeatureLoader>;
    configLoaders: ConfigLoaders;
    publicPath: string;
    publicConfigsRoute: string;
    featureName: string;
    configName: string;
    options: IRunOptions;
}

export async function main({
    env,
    publicPath,
    publicConfigsRoute,
    overrideConfig,
    featureLoaders,
    configLoaders,
    featureName,
    configName,
    options,
}: MainEntryParams) {
    const runtimeConfiguration = new RuntimeConfigurations(env.env, publicConfigsRoute, configLoaders);
    const featureLoader = new FeatureLoadersRegistry(featureLoaders);

    runtimeConfiguration.installChildEnvConfigFetcher(featureName, configName);

    featureName = String(options.get('feature') || featureName);
    configName = String(options.get('config') || configName);

    const instanceId = options.get(INSTANCE_ID_PARAM_NAME);
    if (instanceId) {
        (globalThis as any).name = instanceId;
    }

    const buildConfigPromise = runtimeConfiguration.importConfig(configName);
    const runtimeConfigPromise = runtimeConfiguration.load(env.env, featureName, configName);

    const [buildConfig, runtimeConfig] = await Promise.all([buildConfigPromise, runtimeConfigPromise]);

    // only load features after the config is loaded to avoid blocking onload event
    const { entryFeature, resolvedContexts } = await featureLoader.loadEntryFeature(featureName);

    const topLevelConfig: TopLevelConfig = [
        COM.use({ config: { resolvedContexts, publicPath } }),
        ...buildConfig,
        ...overrideConfig,
        ...runtimeConfig,
    ];

    return new RuntimeEngine(env, topLevelConfig, options).run(entryFeature);
}
