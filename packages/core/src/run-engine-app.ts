import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { Feature } from './entities';
import { deferred, flattenTree, IDeferredPromise } from './helpers';

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
    externalFeatures = [],
}: IRunEngineAppOptions) {
    const runningFeature = features[features.length - 1];

    const engine = new RuntimeEngine([COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run([runningFeature, ...externalFeatures], envName);

    return {
        engine,
        resolvedContexts,
        async dispose() {
            await runningPromise;
            for (const feature of features) {
                await engine.dispose(feature, envName);
            }
        },
    };
}

export class FeatureLoadersRegistry {
    private pendingLoaderRequests = new Map<string, IDeferredPromise<IFeatureLoader>>();
    private loadedFeatures = new Set<string>();
    constructor(
        private featureMapping = new Map<string, IFeatureLoader>(),
        private resolvedContexts: Record<string, string> = {}
    ) {}
    public register(name: string, featureLoader: IFeatureLoader) {
        this.featureMapping.set(name, featureLoader);
        this.pendingLoaderRequests.get(name)?.resolve(featureLoader);
        this.pendingLoaderRequests.delete(name);
    }
    public get(featureName: string): IFeatureLoader | Promise<IFeatureLoader> {
        const featureLoader = this.featureMapping.get(featureName);
        if (featureLoader) {
            return featureLoader;
        }
        let loaderPromise = this.pendingLoaderRequests.get(featureName);
        if (!loaderPromise) {
            loaderPromise = deferred<IFeatureLoader>();
            this.pendingLoaderRequests.set(featureName, loaderPromise);
        }
        return loaderPromise.promise;
    }
    public getRegistered(): string[] {
        return [...this.featureMapping.keys()];
    }
    /**
     * Yields all features which were actially loaded
     */
    async getLoadedFeatures(rootFeatureName: string): Promise<Feature[]> {
        const loaded = [];
        for await (const depName of this.getFeatureDependencies(rootFeatureName)) {
            if (!this.loadedFeatures.has(depName)) {
                this.loadedFeatures.add(depName);
                const loader = this.get(depName);
                loaded.push(loader);
            }
        }
        return Promise.all((await Promise.all(loaded)).map(({ load }) => load(this.resolvedContexts)));
    }
    /**
     * Yields all the dependencies of a feature. doesn't handle duplications
     */
    public async *getFeatureDependencies(featureName: string): AsyncGenerator<string> {
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
