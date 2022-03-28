import { RuntimeEngine } from './runtime-engine';
import type { IRunOptions, TopLevelConfig } from './types';
import type { Feature } from './entities/feature';
import type { AnyEnvironment } from './entities/env';
import { deferred, IDeferredPromise } from './helpers/deferred';
import { flattenTree } from './helpers/flatten-tree';

export interface IRunEngineOptions<ENV extends AnyEnvironment> {
    entryFeature: Feature | Feature[];
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

export interface IRunEngineAppOptions<ENV extends AnyEnvironment> {
    env: ENV;
    options?: Map<string, string | boolean>;
    config?: TopLevelConfig;
    features?: Feature[];
}

export function runEngineApp<ENV extends AnyEnvironment>({
    env,
    options,
    config = [],
    features = [],
}: IRunEngineAppOptions<ENV>) {
    const engine = new RuntimeEngine(env, config, options);
    // const engine = new RuntimeEngine(env, [COM.use({ config: { resolvedContexts, publicPath } }), ...config], options);
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
        // TODO: make the preload parallel
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

// THIS ENTIRE SECTION IS EXTRACTED FROM THE ENTRYPOINT AND WAS NOT TYPED SINCE IT WAS A STRING
// THIS IS AN ATTEMPT TO MAKE THE CODE MANAGEABLE - STILL NOT ALL GOOD
type ConfigLoaders = Record<string, () => Promise<Array<any>>>;

export async function populateConfig(
    currentWindow: Window,
    topWindow: Window,
    envName: string,
    configName: string,
    featureName: string,
    isMainEntrypoint: boolean,
    configLoaders: ConfigLoaders,
    config: TopLevelConfig,
    staticBuild?: boolean,
    publicConfigsRoute?: string,
    topLevelConfig?: TopLevelConfig
) {
    if (staticBuild && configLoaders[configName]) {
        const loadedConfigurations = await configLoaders[configName]!();
        const allLoadedConfigs = await Promise.all(loadedConfigurations);
        config.push(...allLoadedConfigs.flat());
    }
    if (staticBuild && topLevelConfig) {
        config.push(...topLevelConfig);
    }
    if (publicConfigsRoute) {
        config.push(
            ...(await (async () => {
                if (!isMainEntrypoint) {
                    return new Promise((res) => {
                        const configsHandler = ({
                            data: { id, config },
                        }: {
                            data: { id: string; config: unknown };
                        }) => {
                            if (id === publicConfigsRoute) {
                                currentWindow.removeEventListener('message', configsHandler);
                                res(config);
                            }
                        };
                        currentWindow.addEventListener('message', configsHandler);
                        topWindow.postMessage({
                            id: publicConfigsRoute,
                            envName: envName,
                        });
                    });
                } else {
                    return (
                        await fetch(
                            normalizeRoute(publicConfigsRoute) +
                                configName +
                                '?env=' +
                                envName +
                                '&feature=' +
                                featureName
                        )
                    ).json();
                }
            })())
        );
        if (isMainEntrypoint) {
            const fetchedConfigs: Record<string, unknown> = {};
            const configsEventListener = async ({
                data: { id, envName },
                source,
            }: {
                data: { id: string; envName: string };
                source: MessageEventSource | null;
            }) => {
                if (source && id === publicConfigsRoute) {
                    if (!fetchedConfigs[envName]) {
                        const config: unknown = await (
                            await fetch(
                                normalizeRoute(publicConfigsRoute) +
                                    configName +
                                    '?env=' +
                                    envName +
                                    '&feature=' +
                                    featureName
                            )
                        ).json();
                        fetchedConfigs[envName] = config;
                    }
                    source.postMessage({
                        id,
                        config: fetchedConfigs[envName],
                    });
                }
            };
            currentWindow.addEventListener('message', (e) => void configsEventListener(e));
        }
    }
}

function normalizeRoute(route: string) {
    return route + (route && !route.endsWith('/') ? '/' : '');
}
