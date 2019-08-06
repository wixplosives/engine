import { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, DISPOSE, REGISTER_VALUE, RUN, RUN_OPTIONS } from '../symbols';
import {
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
import { AllEnvironments, testEnvironmentCollision, Universal } from './env';

/*************** FEATURE ***************/

export class RuntimeFeature<T extends SomeFeature, Deps extends SomeFeature[], API extends EntityMap> {
    private running = false;
    private runHandlers: Array<() => void> = [];
    private disposeHandlers: DisposeFunction[] = [];

    constructor(
        public feature: T,
        public api: MapToProxyType<API>,
        public dependencies: RunningFeatures<Deps, AllEnvironments['env']>
    ) {}
    public addRunHandler(fn: () => void) {
        this.runHandlers.push(fn);
    }
    public addOnDisposeHandler(fn: DisposeFunction) {
        this.disposeHandlers.push(fn);
    }
    public [RUN](context: RuntimeEngine) {
        if (this.running) {
            return;
        }
        this.running = true;
        for (const dep of this.feature.dependencies) {
            context.runFeature(dep);
        }
        for (const handler of this.runHandlers) {
            handler();
        }
    }

    public async [DISPOSE](context: RuntimeEngine) {
        for (const dep of this.feature.dependencies) {
            await context.dispose(dep);
        }
        for (const handler of this.disposeHandlers) {
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
    public id: ID;
    public dependencies: Deps;
    public api: API;
    public context: EnvironmentContext;
    private environmentIml = new Set<string>();
    private setupHandlers = new Set<SetupHandler<AllEnvironments, ID, Deps, API, EnvironmentContext>>();
    private contextHandlers = new Map<string | number | symbol, () => unknown>();
    constructor(def: FeatureDef<ID, Deps, API, EnvironmentContext>) {
        this.id = def.id;
        this.dependencies = def.dependencies || (([] as IDTagArray) as Deps);
        this.api = def.api || (({} as EntityMap) as API);
        this.context = def.context || ({} as EnvironmentContext);
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
        this.setupHandlers.add(setupHandler);
        return this;
    }
    public use(config: PartialFeatureConfig<API>): [ID, PartialFeatureConfig<API>] {
        return [this.id, config];
    }

    // context = Context<Interface>
    public setupContext<T extends keyof EnvironmentContext>(
        environmentContext: T,
        contextHandler: () => EnvironmentContext[T]['type']
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

    public [CREATE_RUNTIME](context: RuntimeEngine): RuntimeFeature<this, Deps, API> {
        const deps: any = {};
        const depsApis: any = {};
        const runningApi: any = {};
        const inputApi: any = {};
        const providedAPI: any = {};
        const environmentContext: any = {};
        const apiEntries = Object.entries(this.api);
        const feature = new RuntimeFeature<this, Deps, API>(this, runningApi, deps);

        context.features.set(this, feature);

        for (const dep of this.dependencies) {
            deps[dep.id] = context.initFeature(dep);
            depsApis[dep.id] = deps[dep.id].api;
        }

        for (const [key, entity] of apiEntries) {
            const provided = entity[CREATE_RUNTIME](context, this.id, key);
            if (provided !== undefined) {
                inputApi[key] = provided;
            }
        }

        const settingUpFeature = {
            ...inputApi,
            id: this.id,
            run(fn: () => void) {
                feature.addRunHandler(fn);
            },
            onDispose(fn: DisposeFunction) {
                feature.addOnDisposeHandler(fn);
            },
            [RUN_OPTIONS]: {
                params: context.runOptions
            }
        };

        const emptyDispose = { dispose: () => undefined };
        for (const [key, contextHandler] of this.contextHandlers) {
            const contextValue = contextHandler();
            environmentContext[key] = { ...emptyDispose, ...contextValue };
        }

        for (const setupHandler of this.setupHandlers) {
            const featureOutput = setupHandler(settingUpFeature, depsApis, environmentContext);
            for (const [key, entity] of apiEntries) {
                if (featureOutput && entity.providedFrom === Universal) {
                    settingUpFeature[key] = (featureOutput as any)[key];
                }
            }
            Object.assign(providedAPI, featureOutput);
        }

        for (const [key, entity] of apiEntries) {
            const registered = entity[REGISTER_VALUE](context, providedAPI[key], inputApi[key], this.id, key);
            if (registered !== undefined) {
                runningApi[key] = registered;
            }
        }

        return feature;
    }
}
