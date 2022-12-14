import COM from './communication.feature';
import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { AnyEnvironment, FeatureDescriptor } from './entities';
import { flattenTree } from './helpers';
import { deferred, IDeferredPromise } from '@wixc3/common';

export interface IRunEngineOptions<ENV extends AnyEnvironment> {
    entryFeature: FeatureDescriptor | FeatureDescriptor[];
    topLevelConfig?: TopLevelConfig;
    env: ENV;
    runOptions?: IRunOptions;
}

export function run<ENV extends AnyEnvironment>({
    entryFeature,
    topLevelConfig = [],
    env,
    runOptions,
}: IRunEngineOptions<ENV>) {
    return new RuntimeEngine(env, topLevelConfig, runOptions).run(entryFeature);
}

export const getFeaturesDeep = (feature: FeatureDescriptor) => flattenTree(feature, (f) => f.dependencies);

export interface IFeatureLoader {
    load: (resolvedContexts: Record<string, string>) => Promise<FeatureDescriptor> | FeatureDescriptor;
    preload: (
        resolveContexts: Record<string, string>
    ) => Promise<Array<(runtimeOptions: Record<string, string | boolean>) => void | Promise<void>>> | undefined;
    depFeatures: string[];
    resolvedContexts: Record<string, string>;
}

export interface IPreloadModule {
    init?: (runtimeOptions?: Record<string, string | boolean>) => Promise<void> | void;
}

export interface IRunEngineAppOptions<ENV extends AnyEnvironment> {
    config?: TopLevelConfig;
    options?: Map<string, string | boolean>;
    env: ENV;
    publicPath?: string;
    features?: FeatureDescriptor[];
    resolvedContexts: Record<string, string>;
}

export function runEngineApp<ENV extends AnyEnvironment>({
    config = [],
    options,
    env,
    publicPath,
    features = [],
    resolvedContexts = {},
}: IRunEngineAppOptions<ENV>) {
    const engine = new RuntimeEngine(env, [COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
    const runningPromise = engine.run(features);

    return {
        engine,
        async dispose() {
            await runningPromise;
            for (const feature of features) {
                await engine.dispose(feature);
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
    ): Promise<FeatureDescriptor[]> {
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
