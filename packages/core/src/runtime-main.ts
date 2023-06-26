import type { IRunOptions, TopLevelConfig } from './types';
import type { AnyEnvironment } from './entities';
import { FeatureLoadersRegistry, IFeatureLoader } from './run-engine-app';
import { ConfigLoaders, RuntimeConfigurations } from './runtime-configurations';
import { RuntimeEngine } from './runtime-engine';
import { INSTANCE_ID_PARAM_NAME } from './com';

export interface MainEntryParams {
    env: AnyEnvironment;
    featureLoaders: Map<string, IFeatureLoader>;
    configLoaders: ConfigLoaders;
    contextualConfig: (options: { resolvedContexts: Record<string, string> }) => TopLevelConfig;
    publicConfigsRoute: string;
    featureName: string;
    configName: string;
    options: IRunOptions;
}

export async function main({
    env,
    contextualConfig,
    publicConfigsRoute,
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
    if (instanceId && typeof self !== 'undefined') {
        (globalThis as any).name = instanceId;
    }

    const entryPromise = featureLoader.loadEntryFeature(featureName);
    const buildConfigPromise = runtimeConfiguration.importConfig(configName);
    const runtimeConfigPromise = runtimeConfiguration.load(env.env, featureName, configName);

    const [{ entryFeature, resolvedContexts }, buildConfig, runtimeConfig] = await Promise.all([
        entryPromise,
        buildConfigPromise,
        runtimeConfigPromise,
    ]);

    const topLevelConfig: TopLevelConfig = [
        ...buildConfig,
        ...contextualConfig({ resolvedContexts }),
        ...runtimeConfig,
    ];

    return new RuntimeEngine(env, topLevelConfig, options).run(entryFeature);
}
