import { SetMultiMap } from '@file-services/utils';
import { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, DISPOSE, IDENTIFY_API, REGISTER_VALUE, RUN, RUN_OPTIONS } from '../symbols';
import {
    ContextHandler,
    DisposableContext,
    DisposeFunction,
    EntityMap,
    EnvironmentFilter,
    FeatureDef,
    IDTagArray,
    MapToProxyType,
    PartialFeatureConfig,
    RunningFeatures,
    SetupHandler,
    SomeFeature
} from '../types';
import { Environment, testEnvironmentCollision, Universal } from './env';

/*************** FEATURE ***************/

export class RuntimeFeature<T extends SomeFeature, Deps extends SomeFeature[], API extends EntityMap> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => void>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();

    constructor(
        public feature: T,
        public api: MapToProxyType<API>,
        public dependencies: RunningFeatures<Deps, string>
    ) {
    }

    public addRunHandler(fn: () => void, envName: string) {
        this.runHandlers.add(envName, fn);
    }
    public addOnDisposeHandler(fn: DisposeFunction, envName: string) {
        this.disposeHandlers.add(envName, fn);
    }
    public [RUN](context: RuntimeEngine, envName: string) {
        if (this.running) {
            return;
        }
        this.running = true;
        for (const dep of this.feature.dependencies) {
            context.runFeature(dep, envName);
        }
        const envRunHandlers = this.runHandlers.get(envName) || [];
        for (const handler of envRunHandlers) {
            handler();
        }
    }

    public async [DISPOSE](context: RuntimeEngine, envName: string) {
        for (const dep of this.feature.dependencies) {
            await context.dispose(dep, envName);
        }
        const featureDisposeHandlers = this.disposeHandlers.get(envName) || new Set();
        for (const handler of featureDisposeHandlers) {
            await handler();
        }
    }
}

export class Feature<
    ID extends string,
    Deps extends SomeFeature[],
    API extends EntityMap,
    EnvironmentContext extends Record<string, DisposableContext<any>>
    > {
    public asEntity: Feature<ID, SomeFeature[], API, EnvironmentContext> = this;
    public id: ID;
    public dependencies: Deps;
    public api: API;
    public context: EnvironmentContext;
    private environmentIml = new Set<string>();
    private setupHandlers = new SetMultiMap<string, SetupHandler<Environment, ID, Deps, API, EnvironmentContext>>();
    private contextHandlers = new Map<string | number | symbol, ContextHandler<object, EnvironmentFilter, Deps>>();
    constructor(def: FeatureDef<ID, Deps, API, EnvironmentContext>) {
        this.id = def.id;
        this.dependencies = def.dependencies || (([] as IDTagArray) as Deps);
        this.api = def.api || (({} as EntityMap) as API);
        this.context = def.context || ({} as EnvironmentContext);
        this.identifyApis();
    }
    public setup<EnvFilter extends EnvironmentFilter>(
        env: EnvFilter,
        setupHandler: SetupHandler<EnvFilter, ID, Deps, API, EnvironmentContext>
    ): this {
        const containsEnvs = testEnvironmentCollision(env, this.environmentIml);
        if (containsEnvs.length) {
            throw new Error(
                `Feature can only have single setup for each environment. ${this.id} Feature already implements: ${containsEnvs}`
            );
        }
        const envName = typeof env === 'object' ? (env as Record<string, string>).env : (env as string);

        this.setupHandlers.add(envName, setupHandler);
        return this;
    }
    public use(config: PartialFeatureConfig<API>): [ID, PartialFeatureConfig<API>] {
        return [this.id, config];
    }

    // context = Context<Interface>
    public setupContext<K extends keyof EnvironmentContext, Env extends EnvironmentFilter>(
        _env: Env,
        environmentContext: K,
        contextHandler: ContextHandler<EnvironmentContext[K]['type'], Env, Deps>
    ) {
        const registerdContext = this.contextHandlers.get(environmentContext);
        if (registerdContext) {
            throw new Error(
                `Feature can only have single setupContext for each context id. ${
                this.id
                } Feature already implements: ${environmentContext}\n${registerdContext.toString()}`
            );
        }

        this.contextHandlers.set(environmentContext, contextHandler);
        return this;
    }

    public [CREATE_RUNTIME](runningEngine: RuntimeEngine, envName: string): RuntimeFeature<this, Deps, API> {
        const deps: any = {};
        const depsApis: any = {};
        const runningApi: any = {};
        const inputApi: any = {};
        const providedAPI: any = {};
        const environmentContext: any = {};
        const apiEntries = Object.entries(this.api);
        const feature = new RuntimeFeature<this, Deps, API>(this, runningApi, deps);

        runningEngine.features.set(this, feature);

        for (const dep of this.dependencies) {
            deps[dep.id] = runningEngine.initFeature(dep, envName);
            depsApis[dep.id] = deps[dep.id].api;
        }

        for (const [key, entity] of apiEntries) {
            const provided = entity[CREATE_RUNTIME](runningEngine, this.id, key);
            if (provided !== undefined) {
                inputApi[key] = provided;
            }
        }

        const settingUpFeature = {
            ...inputApi,
            id: this.id,
            run(fn: () => void) {
                feature.addRunHandler(fn, envName);
            },
            onDispose(fn: DisposeFunction) {
                feature.addOnDisposeHandler(fn, envName);
            },
            [RUN_OPTIONS]: runningEngine.runOptions
        };

        const emptyDispose = { dispose: () => undefined };
        for (const [key, contextHandler] of this.contextHandlers) {
            const contextValue = contextHandler(depsApis);
            environmentContext[key] = { ...emptyDispose, ...contextValue };
        }
        const setupHandlers: Array<SetupHandler<Environment, ID, Deps, API, EnvironmentContext>> = [];
        const universalSetupHandlers = this.setupHandlers.get('<Universal>');
        const allSetupHandlers = this.setupHandlers.get('<All>');
        const environmentSetupHandlers = this.setupHandlers.get(envName);
        if (universalSetupHandlers) {
            setupHandlers.push(...universalSetupHandlers);
        }
        if (allSetupHandlers) {
            setupHandlers.push(...allSetupHandlers);
        }
        if (environmentSetupHandlers) {
            setupHandlers.push(...environmentSetupHandlers);
        }
        for (const setupHandler of setupHandlers) {
            const featureOutput = setupHandler(settingUpFeature, depsApis, environmentContext);
            for (const [key, entity] of apiEntries) {
                if (featureOutput && entity.providedFrom === Universal) {
                    settingUpFeature[key] = (featureOutput as any)[key];
                }
            }
            Object.assign(providedAPI, featureOutput);
        }

        for (const [key, entity] of apiEntries) {
            const registered = entity[REGISTER_VALUE](runningEngine, providedAPI[key], inputApi[key], this.id, key);
            if (registered !== undefined) {
                runningApi[key] = registered;
            }
        }

        return feature;
    }
    private identifyApis() {
        for (const [key, api] of Object.entries(this.api)) {
            if (api[IDENTIFY_API]) {
                api[IDENTIFY_API]!(this.id, key);
            }
        }
    }
}
