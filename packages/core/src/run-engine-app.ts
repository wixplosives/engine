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
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    envName: string;
    publicPath?: string;
    features?: Feature[];
    resolvedContexts: Record<string, string>;
}

export function runEngineApp({
    config = [],
    options,
    envName,
    publicPath,
    features = [],
    resolvedContexts = {},
}: IRunEngineAppOptions) {
    const runningFeature = features.length ? features[features.length - 1] : [];

    const engine = new RuntimeEngine([COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run(runningFeature, envName);

    return {
        engine,
        async dispose() {
            await runningPromise;
            for (const feature of features) {
                await engine.dispose(feature, envName);
            }
        },
    };
}

export class RuntimeFeatureLoader {
    private pendingFeatures = new SetMultiMap<string, (featueLoader: IFeatureLoader) => unknown>();
    private loadedFeatures = new Set<string>();
    constructor(
        private featureMapping = new Map<string, IFeatureLoader>(),
        private resolvedContexts: Record<string, string> = {}
    ) {}
    register(name: string, featureLoader: IFeatureLoader) {
        this.featureMapping.set(name, featureLoader);
        const pendingCallbacks = this.pendingFeatures.get(name) ?? [];
        for (const cb of pendingCallbacks) {
            cb(featureLoader);
        }
        this.pendingFeatures.deleteKey(name);
    }
    get(featureName: string): Promise<IFeatureLoader> {
        const featureLoader = this.featureMapping.get(featureName);
        if (featureLoader) {
            return Promise.resolve(featureLoader);
        }
        return new Promise((resolve) => this.pendingFeatures.add(featureName, resolve));
    }
    getRunning() {
        return [...this.featureMapping.keys()];
    }
    async *loadFeature(featureName: string): AsyncGenerator<Feature> {
        for await (const depName of this.getFeatureDependencies(featureName)) {
            if (!this.loadedFeatures.has(depName)) {
                this.loadedFeatures.add(depName);
                const loader = await this.get(depName);
                yield loader.load(this.resolvedContexts);
            }
        }
    }
    async *getFeatureDependencies(featureName: string): AsyncGenerator<string> {
        const { depFeatures } = await this.get(featureName);
        for (const depFeature of depFeatures) {
            yield* this.getFeatureDependencies(depFeature);
        }
        yield featureName;
    }
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
