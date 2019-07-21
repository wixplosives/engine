import COM from './communication.feature';
import { flattenTree } from './flatten-tree';
import { RuntimeEngine } from './runtime-engine';
import { SomeFeature, TopLevelConfig } from './types';

export function run(entryFeature: SomeFeature | SomeFeature[], topLevelConfig: TopLevelConfig = []): RuntimeEngine {
    return new RuntimeEngine(topLevelConfig).run(entryFeature);
}

export const getFeaturesDeep = (feature: SomeFeature) => flattenTree(feature, f => f.dependencies);

export interface IFeatureLoader {
    load: () => Promise<SomeFeature>;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export type ConfigLoader = () => Promise<TopLevelConfig>;

export interface IRunEngineAppOptions {
    featureName?: string | null;
    configName?: string | null;
    featureLoaders: Record<string, IFeatureLoader>;
    configLoaders: Record<string, ConfigLoader>;
    overrideConfig?: TopLevelConfig;
}

export async function runEngineApp({
    featureName,
    configName,
    featureLoaders,
    configLoaders,
    overrideConfig = []
}: IRunEngineAppOptions) {
    const featureNames = Object.keys(featureLoaders);
    const configNames = Object.keys(configLoaders);

    featureName = featureName || featureNames[0];
    configName = configName || configNames[0];

    const rootFeatureDef = featureLoaders[featureName];
    if (!rootFeatureDef) {
        throw new Error(`cannot find feature "${featureName}". available features: ${featureNames.join(', ')}`);
    }

    const loadConfig = configLoaders[configName];

    if (!loadConfig) {
        throw new Error(
            `cannot find configuration "${configName}". available configurations: ${configNames.join(', ')}`
        );
    }

    const featuresToLoad = [
        rootFeatureDef.load(),
        ...rootFeatureDef.depFeatures.map(depName => featureLoaders[depName].load())
    ];

    const [config, rootFeature] = await Promise.all<TopLevelConfig | SomeFeature>([loadConfig(), ...featuresToLoad]);

    return {
        runningFeature: rootFeature as SomeFeature,
        engine: new RuntimeEngine([
            COM.use({ config: { contextMappings: rootFeatureDef.resolvedContexts } }),
            ...(config as TopLevelConfig),
            ...overrideConfig
        ]).run(rootFeature as SomeFeature)
    };
}

export function getTopWindow(win: Window): Window {
    while (win.parent && win.parent !== win) {
        win = win.parent;
    }
    return win;
}
