import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import { IRunOptions, TopLevelConfig } from './types';
import { Feature } from './entities';
import { flattenTree } from './helpers';

export interface IRunEngineOptions {
    entryFeature: Feature | Feature[];
    topLevelConfig?: TopLevelConfig;
    envName?: string;
    runOptions?: IRunOptions;
}

export function run({ entryFeature, topLevelConfig = [], envName = '', runOptions }: IRunEngineOptions): RuntimeEngine {
    return new RuntimeEngine(topLevelConfig, runOptions).run(entryFeature, envName);
}

export const getFeaturesDeep = (feature: Feature) => flattenTree(feature, f => f.dependencies);

export interface IFeatureLoader {
    load: (resolvedContexts: Record<string, string>) => Promise<Feature>;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IRunEngineAppOptions {
    featureName?: string | null;
    featureLoaders: Record<string, IFeatureLoader>;
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    envName: string;
}

export async function runEngineApp({
    featureName,
    featureLoaders,
    config = [],
    options,
    envName
}: IRunEngineAppOptions) {
    const featureNames = Object.keys(featureLoaders);

    const rootFeatureLoader = featureName && featureLoaders[featureName];
    if (!rootFeatureLoader) {
        throw new Error(`cannot find feature "${featureName}". available features: ${featureNames.join(', ')}`);
    }

    const { resolvedContexts } = rootFeatureLoader;

    const allFeatures = await Promise.all([
        rootFeatureLoader.load(resolvedContexts),
        ...rootFeatureLoader.depFeatures.map(depName => featureLoaders[depName].load(resolvedContexts))
    ]);
    const [runningFeature] = allFeatures;

    const engine = new RuntimeEngine([COM.use({ config: { resolvedContexts } }), ...config], options).run(
        runningFeature,
        envName
    );

    return {
        async dispose() {
            for (const feature of allFeatures) {
                await engine.dispose(feature, envName);
            }
        }
    };
}

export function getTopWindow(win: Window): Window {
    while (win.parent && win.parent !== win) {
        win = win.parent;
    }
    return win;
}
