import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { Feature } from './entities';
import { flattenTree } from './helpers';

export interface IRunEngineOptions {
    entryFeature: Feature | Feature[];
    topLevelConfig?: TopLevelConfig;
    envName?: string;
    runOptions?: IRunOptions;
}

export function run({ entryFeature, topLevelConfig = [], envName = '', runOptions }: IRunEngineOptions) {
    return new RuntimeEngine(topLevelConfig, runOptions).run(entryFeature, envName);
}

export const getFeaturesDeep = (feature: Feature) => flattenTree(feature, (f) => f.dependencies as Feature[]);

export interface IFeatureLoader {
    load: (resolvedContexts: Record<string, string>) => Promise<Feature>;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IRunEngineAppOptions {
    featureName?: string;
    featureLoaders: Record<string, IFeatureLoader>;
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    envName: string;
    publicPath?: string;
}

export async function runEngineApp({
    featureName,
    featureLoaders,
    config = [],
    options,
    envName,
    publicPath,
}: IRunEngineAppOptions) {
    const featureNames = Object.keys(featureLoaders);

    const rootFeatureLoader = featureName && featureLoaders[featureName];
    if (!rootFeatureLoader) {
        throw new Error(`cannot find feature "${featureName!}". available features: ${featureNames.join(', ')}`);
    }

    const { resolvedContexts } = rootFeatureLoader;

    const allFeatures = await Promise.all([
        rootFeatureLoader.load(resolvedContexts),
        ...rootFeatureLoader.depFeatures.map((depName) => featureLoaders[depName].load(resolvedContexts)),
    ]);
    const [runningFeature] = allFeatures;

    const engine = new RuntimeEngine([COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run(runningFeature, envName);

    return {
        engine,
        async dispose() {
            await runningPromise;
            for (const feature of allFeatures) {
                await engine.dispose(feature, envName);
            }
        },
    };
}

export function runtimeFeatureLoader(resolvedContexts: Record<string, string>) {
    const featureMapping = new Map<string, IFeatureLoader>();
    return {
        register(name: string, featureLoader: IFeatureLoader) {
            featureMapping.set(name, featureLoader);
        },
        async load(engine: RuntimeEngine, featureName: string, envName: string) {
            const featureLoader = featureMapping.get(featureName);
            if (!featureLoader) {
                throw new Error('cannot load unregistered feature');
            }
            const feature = await featureLoader.load(resolvedContexts);
            const runtimeFeature = engine.features.get(feature);
            if (runtimeFeature) {
                return runtimeFeature;
            }
            engine.initFeature(feature, envName);
            return engine.runFeature(feature, envName);
        },
        get(featureName: string) {
            return featureMapping.get(featureName);
        },
    };
}
export function getTopWindow(win: Window): Window {
    while (win.parent && win.parent !== win && canAccessWindow(win.parent)) {
        win = win.parent;
    }
    return win;
}

export function canAccessWindow(win: Window): boolean {
    try {
        return typeof win.location.search === 'string';
    } catch {
        return false;
    }
}
