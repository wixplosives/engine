import COM from './communication.feature';
import { flattenTree } from './flatten-tree';
import { RuntimeEngine } from './runtime-engine';
import { IRunOptions, SomeFeature, TopLevelConfig } from './types';

export function run(
    entryFeature: SomeFeature | SomeFeature[],
    topLevelConfig: TopLevelConfig = [],
    runOptions?: IRunOptions
): RuntimeEngine {
    return new RuntimeEngine(topLevelConfig, runOptions).run(entryFeature);
}

export const getFeaturesDeep = (feature: SomeFeature) => flattenTree(feature, f => f.dependencies);

export interface IFeatureLoader {
    load: (resolvedContexts: Record<string, string>) => Promise<SomeFeature>;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IRunEngineAppOptions {
    featureName?: string | null;
    featureLoaders: Record<string, IFeatureLoader>;
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
}

export async function runEngineApp({ featureName, featureLoaders, config = [], options }: IRunEngineAppOptions) {
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
        runningFeature
    );

    return {
        async dispose() {
            for (const feature of allFeatures) {
                await engine.dispose(feature);
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
