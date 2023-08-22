import type { RuntimeEngine } from './runtime-engine.js';
import type { AnyEnvironment } from './entities/env.js';
import {
    type FeatureClass,
    type RunningFeatures,
    type SettingUpFeatureBase,
    instantiateFeature,
} from './entities/feature.js';
import { CREATE_RUNTIME, ENGINE, REGISTER_VALUE, RUN, RUN_OPTIONS } from './symbols.js';
import { SetMultiMap } from '@wixc3/patterns';
import type { Context, DisposeFunction, Running } from './types.js';
import { deferred, type IDeferredPromise } from 'promise-assist';

/**
 * Represents a currently running feature instance.
 **/
export class RuntimeFeature<T extends FeatureClass, ENV extends AnyEnvironment> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => unknown>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();
    private disposing: IDeferredPromise<void> | undefined;
    constructor(
        public feature: InstanceType<T>,
        public api: Running<T, ENV>,
        public dependencies: RunningFeatures<InstanceType<T>['dependencies'], ENV>,
        public environment: ENV,
    ) {}
    public addRunHandler = (fn: () => unknown) => {
        this.runHandlers.add(this.environment.env, fn);
    };
    public addOnDisposeHandler = (fn: DisposeFunction) => {
        this.disposeHandlers.add(this.environment.env, fn);
    };
    public async dispose() {
        if (this.disposing) {
            return this.disposing.promise;
        }
        this.disposing = deferred();
        const featureDisposeHandlers = this.disposeHandlers.get(this.environment.env) || new Set();
        for (const handler of featureDisposeHandlers) {
            await handler();
        }
        this.disposing.resolve();
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
}

export function createFeatureRuntime<F extends FeatureClass, E extends AnyEnvironment>(
    FeatureClass: F,
    runningEngine: RuntimeEngine<E>,
): RuntimeFeature<F, E> {
    const { features, runOptions, referencedEnvs, entryEnvironment } = runningEngine;
    const feature = instantiateFeature(FeatureClass);
    const deps: RunningFeatures<InstanceType<any>['dependencies'], any> = {};
    const depsApis: Record<string, Running<FeatureClass, E>> = {};
    const runningApi: Record<string, unknown> = {};
    const inputApi: Record<string, unknown> = {};
    const providedApi: Record<string, unknown> = {};
    const environmentContext: Record<string, Context<any>['type']> = {};
    const apiEntries = Object.entries(feature.api);

    const contextHandlers = FeatureClass.runtimeInfo?.contexts;
    const setupHandlers = FeatureClass.runtimeInfo?.setups;

    const featureRuntime = new RuntimeFeature(feature, runningApi, deps, entryEnvironment);
    features.set(FeatureClass, featureRuntime);

    for (const dep of feature.dependencies) {
        const instance = runningEngine.initFeature(dep);
        deps[instance.feature.id] = instance;
        depsApis[instance.feature.id] = instance.api;
    }

    for (const [key, entity] of apiEntries) {
        const provided = entity[CREATE_RUNTIME](runningEngine, feature.id, key);
        if (provided !== undefined) {
            inputApi[key] = provided;
        }
    }
    const settingUpFeature: SettingUpFeatureBase<F, E> & Record<string, unknown> = {
        ...inputApi,
        id: feature.id,
        run: featureRuntime.addRunHandler,
        onDispose: featureRuntime.addOnDisposeHandler,
        [RUN_OPTIONS]: runOptions,
        [ENGINE]: runningEngine,
    };

    if (contextHandlers) {
        for (const [key, contextHandler] of contextHandlers) {
            environmentContext[key] = {
                dispose: () => void 0,
                ...contextHandler(depsApis),
            };
        }
    }

    if (setupHandlers) {
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
                Object.assign(providedApi, featureOutput);
            }
        }
    }

    for (const [key, entity] of apiEntries) {
        const registered = entity[REGISTER_VALUE](runningEngine, providedApi[key], inputApi[key], feature.id, key);
        if (registered !== undefined) {
            runningApi[key] = registered;
        }
    }

    return featureRuntime;
}
