import type { RuntimeEngine } from './runtime-engine';
import type { AnyEnvironment } from './entities/env';
import type { FeatureDescriptor, RunningFeaturesV2 } from './entities/feature-descriptor';
import { CREATE_RUNTIME, DISPOSE, ENGINE, IDENTIFY_API, REGISTER_VALUE, RUN, RUN_OPTIONS } from './symbols';
import { SetMultiMap } from '@wixc3/patterns';
import type { DisposeFunction, Running } from './types';
import { deferred, IDeferredPromise } from 'promise-assist';

// interface RuntimeFeature<F, E> {
//     [RUN](engine: RuntimeEngine): Promise<void>;
//     [DISPOSE](engine: RuntimeEngine): Promise<void>;
//     addRunHandler(fn: () => unknown, envName: string): void;
//     addOnDisposeHandler(fn: DisposeFunction, envName: string): void;
//     api: Running<F, E>;
//     dependencies: RunningFeatures<F['dependencies'], E>;
// }

/**
 * Represents a currently running feature instance.
 **/
export class RuntimeFeature<T extends FeatureDescriptor, ENV extends AnyEnvironment> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => unknown>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();
    private disposing: IDeferredPromise<void> | undefined;

    constructor(
        public feature: T,
        public api: Running<T, ENV>,
        public dependencies: RunningFeaturesV2<T['dependencies'], ENV>
    ) {}

    public addRunHandler(fn: () => unknown, envName: string) {
        this.runHandlers.add(envName, fn);
    }
    public addOnDisposeHandler(fn: DisposeFunction, envName: string) {
        this.disposeHandlers.add(envName, fn);
    }
    public async [RUN](engine: RuntimeEngine): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;
        const runPromises: Array<unknown> = [];
        for (const envName of engine.referencedEnvs) {
            for (const dep of this.feature.dependencies) {
                runPromises.push(engine.runFeature(dep));
            }
            const envRunHandlers = this.runHandlers.get(envName);
            if (envRunHandlers) {
                for (const handler of envRunHandlers) {
                    runPromises.push(handler());
                }
            }
        }

        await Promise.all(runPromises);
    }
    public async [DISPOSE](engine: RuntimeEngine) {
        const {
            entryEnvironment: { env: envName },
        } = engine;
        if (this.disposing) {
            return this.disposing.promise;
        }
        this.disposing = deferred();
        // THIS IS WRONG!
        for (const dep of this.feature.dependencies) {
            await engine.disposeFeature(dep);
        }
        const featureDisposeHandlers = this.disposeHandlers.get(envName) || new Set();
        for (const handler of featureDisposeHandlers) {
            await handler();
        }
        this.running = false;
        return this.disposing.resolve();
    }
}

export function createFeatureRuntime<F extends FeatureDescriptor, E extends AnyEnvironment>(
    feature: F,
    runningEngine: RuntimeEngine<E>
): RuntimeFeature<F, E> {
    const {
        features,
        runOptions,
        referencedEnvs,
        entryEnvironment: { env: envName },
    } = runningEngine;

    const deps: any = {};
    const depsApis: any = {};
    const runningApi: any = {};
    const inputApi: any = {};
    const providedAPI: any = {};
    const environmentContext: any = {};
    const apiEntries = Object.entries(feature.api);

    const setupHandlers = feature.runtimeInfo!.setup || [];
    const contextHandlers = feature.runtimeInfo!.context || [];

    for (const [key, api] of Object.entries(feature.api)) {
        const entityFn = api[IDENTIFY_API];
        if (entityFn) {
            entityFn.call(api, feature.id, key);
        }
    }

    const featureRuntime = new RuntimeFeature(feature, runningApi, deps);
    features.set(feature, featureRuntime);

    for (const dep of feature.dependencies) {
        const instance = runningEngine.initFeature(dep);
        deps[dep.id] = instance;
        depsApis[dep.id] = instance.api;
    }

    for (const [key, entity] of apiEntries) {
        const provided = entity[CREATE_RUNTIME](runningEngine, feature.id, key);
        if (provided !== undefined) {
            inputApi[key] = provided;
        }
    }
    const settingUpFeature = {
        ...inputApi,
        id: feature.id,
        run(fn: () => void) {
            featureRuntime.addRunHandler(fn, envName);
        },
        onDispose(fn: () => unknown) {
            featureRuntime.addOnDisposeHandler(fn, envName);
        },
        [RUN_OPTIONS]: runOptions,
        [ENGINE]: runningEngine,
        runningEnvironmentName: envName,
    };

    for (const [key, contextHandler] of contextHandlers) {
        environmentContext[key] = {
            dispose: () => void 0,
            ...contextHandler(depsApis),
        };
    }

    for (const envName of referencedEnvs) {
        const environmentSetupHandlers = setupHandlers.get(envName);
        if (!environmentSetupHandlers) {
            continue;
        }
        for (const setupHandler of environmentSetupHandlers) {
            const featureOutput = setupHandler(settingUpFeature, depsApis, environmentContext);
            if (!featureOutput) {
                continue;
            }
            for (const key of Object.keys(featureOutput)) {
                settingUpFeature[key] = featureOutput[key];
            }
            Object.assign(providedAPI, featureOutput);
        }
    }

    for (const [key, entity] of apiEntries) {
        const registered = entity[REGISTER_VALUE](runningEngine, providedAPI[key], inputApi[key], feature.id, key);
        if (registered !== undefined) {
            runningApi[key] = registered;
        }
    }

    return featureRuntime;
}
