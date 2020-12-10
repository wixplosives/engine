import fs from '@file-services/node';
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
    flattenTree,
} from '@wixc3/engine-core';
import { readFeatures, evaluateConfig, createFeatureLoaders, IFeatureDefinition } from '@wixc3/engine-scripts';

export interface IRunNodeEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    /**
     * from where to locate features
     * @default {process.cwd()}
     */
    basePath?: string;
    /**
     * base folder to locate features from within basePath
     */
    featureDiscoveryRoot?: string;
    env: Environment;
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
    featureDiscoveryRoot: featureDirectoryRoot,
}: IRunNodeEnvironmentOptions): Promise<{
    engine: RuntimeEngine;
    dispose: () => Promise<void>;
}> {
    const { env: name, envType: type } = env;
    const { features, configurations } = readFeatures(fs, basePath, featureDirectoryRoot);

    if (configName) {
        config = [...evaluateConfig(configName, configurations, name), ...config];
    }

    const featureDef = features.get(featureName);

    const childEnvName = featureDef?.resolvedContexts[name];

    if (childEnvName) {
        const { type } = locateEnvironment(featureDef!, features, name, childEnvName);
        if (type !== 'node') {
            throw new Error(`Trying to run ${name} with the ${childEnvName} context, the target of which is ${type}`);
        }
    }

    const featureLoaders = createFeatureLoaders(features, {
        name,
        childEnvName,
        type,
    });
    const rootFeatureLoader = featureLoaders[featureName];
    if (!rootFeatureLoader) {
        throw new Error(
            "cannot find feature '" + featureName + "'. available features: " + Object.keys(featureLoaders).join(', ')
        );
    }
    const { resolvedContexts = {} } = rootFeatureLoader;

    const featureLoader = new FeatureLoadersRegistry(new Map(Object.entries(featureLoaders)), resolvedContexts);
    const loadedFeatures = await featureLoader.getLoadedFeatures(featureName, runtimeOptions);

    return runEngineApp({
        config,
        options: new Map(Object.entries(runtimeOptions)),
        envName: name,
        features: loadedFeatures,
        resolvedContexts,
    });
}

function locateEnvironment(
    featureDef: IFeatureDefinition,
    features: Map<string, IFeatureDefinition>,
    name: string,
    childEnvName: string
) {
    const deepDefsForFeature = flattenTree<IFeatureDefinition>(featureDef, (f) =>
        f.dependencies.map((fName) => features.get(fName)!)
    );
    for (const { exportedEnvs } of deepDefsForFeature) {
        for (const env of exportedEnvs) {
            if (env.name === name && env.childEnvName === childEnvName) {
                return env;
            }
        }
    }

    throw new Error(
        `environment ${name} with the context ${childEnvName} is not found when running ${featureDef.name} feature`
    );
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
    feature,
    featureDiscoveryRoot: featureDirectoryRoot,
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
        basePath,
        featureDiscoveryRoot: featureDirectoryRoot,
    });
    const { api } = engine.get(feature);
    return {
        runningApi: api,
        engine,
        dispose,
    };
}
