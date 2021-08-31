import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { Environment, Feature } from './entities';
import { deferred, flattenTree, IDeferredPromise } from './helpers';

export interface IRunEngineOptions<ENV extends Environment> {
    entryFeature: Feature | Feature[];
    topLevelConfig?: TopLevelConfig;
    envName?: ENV['env'];
    runOptions?: IRunOptions;
}

export function run<ENV extends Environment<any, any, any, any>>({
    entryFeature,
    topLevelConfig = [],
    envName = '',
    runOptions,
}: IRunEngineOptions<ENV>) {
    return new RuntimeEngine<ENV>(topLevelConfig, runOptions).run(entryFeature, envName);
}

export const getFeaturesDeep = (feature: Feature) => flattenTree(feature, (f) => f.dependencies as Feature[]);

export interface IFeatureLoader {
    load: (resolvedContexts: Record<string, string>) => Promise<Feature> | Feature;
    preload: (
        resolveContexts: Record<string, string>
    ) => Promise<Array<(runtimeOptions: Record<string, string | boolean>) => void | Promise<void>>> | undefined;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IPreloadModule {
    init?: (runtimeOptions?: Record<string, string | boolean>) => Promise<void> | void;
}

export interface IRunEngineAppOptions {
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    envName: string;
    publicPath?: string;
    features?: Feature[];
    resolvedContexts: Record<string, string>;
}

export function runEngineApp<ENV extends Environment = Environment<any, any, any>>({
    config = [],
    options,
    envName,
    publicPath,
    features = [],
    resolvedContexts = {},
}: IRunEngineAppOptions) {
    const engine = new RuntimeEngine<ENV>([COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run(features, envName);

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
     * returns all features which were actially loaded
     */
    async getLoadedFeatures(
        rootFeatureName: string,
        runtimeOptions: Record<string, string | boolean> = {}
    ): Promise<Feature[]> {
        const loaded = [];
        const dependencies = await this.getFeatureDependencies(rootFeatureName);
        for await (const depName of dependencies.reverse()) {
            if (!this.loadedFeatures.has(depName)) {
                this.loadedFeatures.add(depName);
                const loader = this.get(depName);
                loaded.push(loader);
            }
        }
        const featureLoaders = await Promise.all(loaded);
        const allPreloadInitFunctions = [];
        for (const featureLoader of featureLoaders) {
            if (featureLoader.preload) {
                const featureInitFunctions = await featureLoader.preload(this.resolvedContexts);
                if (featureInitFunctions) {
                    allPreloadInitFunctions.push(...featureInitFunctions);
                }
            }
        }
        for (const initFunction of allPreloadInitFunctions) {
            await initFunction(runtimeOptions);
        }
        return Promise.all(featureLoaders.map(({ load }) => load(this.resolvedContexts)));
    }
    /**
     * returns all the dependencies of a feature. doesn't handle duplications
     */
    public async getFeatureDependencies(featureName: string): Promise<string[]> {
        const dependencies: string[] = [featureName];
        const features = [featureName];
        while (features.length) {
            const { depFeatures } = await this.get(features.shift()!);
            for (const depFeature of depFeatures) {
                if (!dependencies.includes(depFeature)) {
                    dependencies.push(depFeature);
                    features.push(depFeature);
                }
            }
        }
        return dependencies;
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
