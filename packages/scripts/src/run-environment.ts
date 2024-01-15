import { nodeFs as fs } from '@file-services/node';
import {
    BaseHost,
    COM,
    Communication,
    RuntimeEngine,
    flattenTree,
    type AnyEnvironment,
    type FeatureClass,
    type Running,
    type TopLevelConfig,
} from '@wixc3/engine-core';
import {
    ENGINE_ROOT_ENVIRONMENT_ID,
    IStaticFeatureDefinition,
    METADATA_PROVIDER_ENV_ID,
    MetadataCollectionAPI,
    loadTopLevelConfigs,
    metadataApiToken,
    runNodeEnvironment,
} from '@wixc3/engine-runtime-node';
import { findFeatures } from './analyze-feature/index.js';
import { ENGINE_CONFIG_FILE_NAME } from './build-constants.js';
import { EngineConfig, IFeatureDefinition } from './types.js';

export interface IRunNodeEnvironmentOptions<ENV extends AnyEnvironment = AnyEnvironment> {
    featureName: string;
    bundlePath?: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    config?: TopLevelConfig;
    /**
     * from where to locate features
     * @defaultValue process.cwd()
     */
    basePath?: string;
    /**
     * base folder to locate features from within basePath
     */
    featureDiscoveryRoot?: string;
    env: ENV;
}

export interface RunningFeatureOptions<F extends FeatureClass, ENV extends AnyEnvironment>
    extends IRunNodeEnvironmentOptions<ENV> {
    feature: F;
}

function memoize<T extends (...args: string[]) => any>(fn: T): T {
    const cache = new Map<string, ReturnType<T>>();
    return ((...args: string[]) => {
        const key = args.join(',');
        if (!cache.has(key)) {
            cache.set(key, fn(...args));
        }
        return cache.get(key)!;
    }) as T;
}

async function getFeatures(basePath: string, featureDiscoveryRoot?: string) {
    const engineConfigFilePath = await fs.promises.findClosestFile(basePath, ENGINE_CONFIG_FILE_NAME);
    const {
        featureDiscoveryRoot: configFeatureDiscoveryRoot,
        extensions,
        buildConditions,
        require: requiredModules,
    } = (engineConfigFilePath ? await importWithProperError(engineConfigFilePath) : {}) as EngineConfig;

    const { features, configurations } = await findFeatures(
        basePath,
        fs,
        featureDiscoveryRoot ?? configFeatureDiscoveryRoot,
        extensions,
        buildConditions,
    );
    return {
        features,
        configurations,
        requiredModules,
    };
}

/** it's possible to memoize this function because the features are not expected to change during the runtime of the process */
const getFeaturesMemo = memoize(getFeatures);

async function runEngineEnvironment<ENV extends AnyEnvironment>({
    featureName,
    configName,
    bundlePath,
    runtimeOptions = {},
    config = [],
    env,
    basePath = process.cwd(),
    featureDiscoveryRoot,
}: IRunNodeEnvironmentOptions<ENV>): Promise<RuntimeEngine<ENV>> {
    const { features, configurations, requiredModules } = await getFeaturesMemo(basePath, featureDiscoveryRoot);
    const { env: envName, envType } = env;
    if (configName) {
        config = [...(await loadTopLevelConfigs(configName, configurations, envName)), ...config];
    }
    const featureDef = features.get(featureName)!;

    const childEnvName = featureDef?.resolvedContexts[envName];
    if (childEnvName) {
        const env = locateEnvironment(featureDef, features, envName, childEnvName);
        if (!env) {
            throw new Error(
                `environment "${envName}" with the context "${childEnvName}" is not found when running "${featureDef.scopedName}" feature`,
            );
        }
        if (env.type !== 'node') {
            throw new Error(
                `Trying to run "${envName}" with the "${childEnvName}" context, the target of which is "${env.type}"`,
            );
        }
    }

    const rootEngineEnvHost = new BaseHost();
    const com = new Communication(rootEngineEnvHost, ENGINE_ROOT_ENVIRONMENT_ID);

    const staticFeatures = [...features].map(([featureName, feature]) => [featureName, feature.toJSON()]) as [
        featureName: string,
        featureDefinition: IStaticFeatureDefinition,
    ][];

    com.registerAPI<MetadataCollectionAPI>(metadataApiToken, {
        getRuntimeArguments: () => {
            return {
                basePath: process.cwd(),
                config: [],
                featureName,
                features: staticFeatures,
                outputPath: process.cwd(),
                nodeEntryPath: '',
                runtimeOptions: Object.entries(runtimeOptions),
                requiredModules,
            };
        },
    });

    const metadataProviderHost = new BaseHost();
    metadataProviderHost.name = METADATA_PROVIDER_ENV_ID;
    com.registerEnv(METADATA_PROVIDER_ENV_ID, metadataProviderHost);

    config.push(
        COM.use({
            config: {
                connectedEnvironments: {
                    [ENGINE_ROOT_ENVIRONMENT_ID]: {
                        id: ENGINE_ROOT_ENVIRONMENT_ID,
                        host: rootEngineEnvHost,
                    },
                    [METADATA_PROVIDER_ENV_ID]: {
                        id: METADATA_PROVIDER_ENV_ID,
                        host: metadataProviderHost,
                    },
                },
            },
        }),
    );

    return runNodeEnvironment({
        featureName,
        features: [...features.entries()],
        bundlePath,
        name: envName,
        type: envType,
        childEnvName,
        config,
        options: Object.entries(runtimeOptions),
        context: basePath,
        env,
    });
}

function locateEnvironment(
    featureDef: IFeatureDefinition,
    features: Map<string, IFeatureDefinition>,
    name: string,
    childEnvName: string,
) {
    const deepDefsForFeature = flattenTree<IFeatureDefinition>(
        featureDef,
        (f) => f.dependencies?.map((fName) => features.get(fName)!) ?? [],
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

export async function getRunningFeature<F extends FeatureClass, ENV extends AnyEnvironment>(
    options: RunningFeatureOptions<F, ENV>,
): Promise<{
    runningApi: Running<F, ENV>;
    engine: RuntimeEngine;
    /**@deprecated use engine.shutdown */
    dispose: () => Promise<void>;
}> {
    const { feature } = options;
    const engine = await runEngineEnvironment(options);
    const { api } = engine.get(feature);

    return {
        runningApi: api,
        engine,
        dispose: engine.shutdown,
    };
}

async function importWithProperError(filePath: string): Promise<unknown> {
    try {
        return ((await import(filePath)) as { default: unknown }).default;
    } catch (ex) {
        throw new Error(`failed importing file: ${filePath}`, { cause: ex });
    }
}
