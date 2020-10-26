import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { Feature } from './entities';
import { flattenTree, SetMultiMap } from './helpers';

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
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    envName: string;
    publicPath?: string;
    featureLoader?: RuntimeFeatureLoader;
}

export async function runEngineApp({
    featureName,
    config = [],
    options,
    envName,
    publicPath,
    featureLoader = new RuntimeFeatureLoader(),
}: IRunEngineAppOptions) {
    const rootFeatureLoader = featureName && (await featureLoader.get(featureName, false));
    if (featureName && !rootFeatureLoader) {
        throw new Error(
            `cannot find feature "${featureName}". available features: ${featureLoader.getRunning().join(', ')}`
        );
    }
    const { resolvedContexts = {} } = rootFeatureLoader || {};

    async function* loadFeature(featureName: string): AsyncGenerator<Feature> {
        const visitedDeps = new Set<string>();
        for await (const depName of getFeatureDependencies(featureName, featureLoader)) {
            if (!visitedDeps.has(depName)) {
                visitedDeps.add(depName);
                const loader = await featureLoader.get(depName);
                yield loader.load(resolvedContexts);
            }
        }
    }

    const allFeatures: Feature[] = [];

    if (featureName) {
        for await (const feature of loadFeature(featureName)) {
            allFeatures.push(feature);
        }
    }
    const runningFeature = allFeatures.length ? allFeatures[allFeatures.length - 1] : [];

    const engine = new RuntimeEngine([COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run(runningFeature, envName);

    return {
        engine,
        resolvedContexts,
        async dispose() {
            await runningPromise;
            for (const feature of allFeatures) {
                await engine.dispose(feature, envName);
            }
        },
        loadFeature,
    };
}

export class RuntimeFeatureLoader {
    private pendingFeatures = new SetMultiMap<string, (featueLoader: IFeatureLoader) => unknown>();
    constructor(private featureMapping = new Map<string, IFeatureLoader>()) {}
    register(name: string, featureLoader: IFeatureLoader) {
        this.featureMapping.set(name, featureLoader);
        const pendingCallbacks = this.pendingFeatures.get(name) ?? [];
        for (const cb of pendingCallbacks) {
            cb(featureLoader);
        }
    }
    get(featureName: string, waitForLoad?: true): Promise<IFeatureLoader>;
    get(featureName: string, waitForLoad?: false): Promise<IFeatureLoader | false>;
    get(featureName: string, waitForLoad = true): Promise<IFeatureLoader | false> {
        const featureLoader = this.featureMapping.get(featureName);
        if (featureLoader) {
            return Promise.resolve(featureLoader);
        }
        if (waitForLoad) {
            return new Promise((resolve) => this.pendingFeatures.add(featureName, resolve));
        }
        return Promise.resolve(false);
    }
    getRunning() {
        return [...this.featureMapping.keys()];
    }
}

export async function* getFeatureDependencies(
    featureName: string,
    featureLoader: RuntimeFeatureLoader
): AsyncGenerator<string> {
    const { depFeatures } = await featureLoader.get(featureName);
    for (const depFeature of depFeatures) {
        yield* getFeatureDependencies(depFeature, featureLoader);
    }
    yield featureName;
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
