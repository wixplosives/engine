import * as EngineCore from './index';

interface Options {
    env: EngineCore.AnyEnvironment;
    topLevelConfig: EngineCore.TopLevelConfig;
    featureLoaders: Map<string, EngineCore.IFeatureLoader>;
    configLoaders: EngineCore.ConfigLoaders;
    publicPath: string;
    publicConfigsRoute: string;
    featureName: string;
    configName: string;
}

export async function main({
    env,
    publicPath,
    publicConfigsRoute,
    topLevelConfig,
    featureLoaders,
    configLoaders,
    featureName,
    configName,
}: Options) {
    (globalThis as any).EngineCore ||= EngineCore;
    // TODO: check if we can remove EngineCore
    const { FeatureLoadersRegistry, RuntimeConfigurations, RuntimeEngine, COM } = EngineCore;
    const runtimeConfiguration = new RuntimeConfigurations(env.env, configLoaders);

    const options = runtimeConfiguration.getEntryOptions();

    featureName = String(options.get('feature')) || featureName;
    configName = String(options.get('config')) || configName;

    const rootFeatureLoader = featureLoaders.get(featureName);
    if (!rootFeatureLoader) {
        throw new Error(
            "cannot find feature '" +
                featureName +
                "'. available features:\\n" +
                Array.from(featureLoaders.keys()).join('\\n')
        );
    }
    const { resolvedContexts = {} } = rootFeatureLoader;
    const featureLoader = new FeatureLoadersRegistry(featureLoaders, resolvedContexts);

    const instanceId = options.get(EngineCore.INSTANCE_ID_PARAM_NAME);
    if (instanceId) {
        (globalThis as any).name = instanceId;
    }

    const config = [
        COM.use({ config: { resolvedContexts, publicPath } }),
        // import static config
        ...(await runtimeConfiguration.importConfig(configName)),
        // override
        ...topLevelConfig,
        // import public config
        ...(await runtimeConfiguration.load(publicConfigsRoute, env.env, featureName, configName)),
    ];

    runtimeConfiguration.installChildEnvConfigFetcher(publicConfigsRoute, featureName, configName);

    return new RuntimeEngine(env, config, options).run(await featureLoader.loadEntryFeature(featureName));
}
