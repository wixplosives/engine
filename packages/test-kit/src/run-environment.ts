import fs from '@file-services/node';
import {
    readFeatures,
    evaluateConfig,
    runNodeEnvironment,
    IFeatureDefinition,
    IExternalFeatureNodeDescriptor,
} from '@wixc3/engine-scripts';
import {
    TopLevelConfig,
    Environment,
    Feature,
    EntityRecord,
    DisposableContext,
    RuntimeEngine,
    flattenTree,
    NormalizeEnvironmentFilter,
    Running,
} from '@wixc3/engine-core';

export interface IRunNodeEnvironmentOptions<ENV extends Environment = Environment> {
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
    env: ENV;
    externalFeatures?: IExternalFeatureNodeDescriptor[];
}

export interface IGetRuinnnigFeatureOptions<
    NAME extends string,
    DEPS extends Feature[],
    API extends EntityRecord,
    CONTEXT extends Record<string, DisposableContext<any>>,
    ENV extends Environment
> extends IRunNodeEnvironmentOptions<ENV> {
    feature: Feature<NAME, DEPS, API, CONTEXT>;
}

export async function runEngineEnvironment({
    featureName,
    configName,
    runtimeOptions = {},
    config = [],
    env,
    basePath = process.cwd(),
    externalFeatures = [],
    featureDiscoveryRoot,
}: IRunNodeEnvironmentOptions): Promise<{
    engine: RuntimeEngine;
    dispose: () => Promise<void>;
}> {
    const { env: name, envType: type } = env;
    const { features, configurations } = readFeatures(fs, basePath, featureDiscoveryRoot);

    if (configName) {
        config = [...evaluateConfig(configName, configurations, name), ...config];
    }
    const featureDef = features.get(featureName);

    const childEnvName = featureDef?.resolvedContexts[name];
    if (childEnvName) {
        const env = locateEnvironment(featureDef!, features, name, childEnvName);
        if (!env) {
            throw new Error(
                `environment "${name}" with the context "${childEnvName}" is not found when running "${
                    featureDef!.name
                }" feature`
            );
        }
        if (env.type !== 'node') {
            throw new Error(
                `Trying to run "${name}" with the "${childEnvName}" context, the target of which is "${env.type}"`
            );
        }
    }
    return runNodeEnvironment({
        featureName,
        features: [...features.entries()],
        name,
        type,
        childEnvName,
        config,
        externalFeatures,
        options: Object.entries(runtimeOptions),
        context: basePath,
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

    return undefined;
}

export async function getRunningFeature<
    NAME extends string,
    DEPS extends Feature[],
    API extends EntityRecord,
    CONTEXT extends Record<string, DisposableContext<any>>,
    ENV extends Environment
>(
    options: IGetRuinnnigFeatureOptions<NAME, DEPS, API, CONTEXT, ENV>
): Promise<{
    dispose: () => Promise<void>;
    runningApi: Running<Feature<NAME, DEPS, API, CONTEXT>, NormalizeEnvironmentFilter<ENV>>;
    engine: RuntimeEngine;
}> {
    const { feature } = options;
    const { engine, dispose } = await runEngineEnvironment(options);
    const { api } = engine.get(feature);
    return {
        runningApi: api,
        engine,
        dispose,
    };
}
