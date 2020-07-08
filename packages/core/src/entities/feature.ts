import type { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, DISPOSE, IDENTIFY_API, REGISTER_VALUE, RUN, RUN_OPTIONS } from '../symbols';
import type {
    ContextHandler,
    DisposableContext,
    DisposeFunction,
    EntityRecord,
    EnvironmentFilter,
    FeatureDef,
    MapToProxyType,
    PartialFeatureConfig,
    RunningFeatures,
    SetupHandler,
} from '../types';
import { Environment, testEnvironmentCollision, getEnvName, isGloballyProvided } from './env';
import { SetMultiMap } from '../helpers';

/*************** FEATURE ***************/

export class RuntimeFeature<
    T extends Feature = Feature,
    Deps extends Feature[] = Feature[],
    API extends EntityRecord = EntityRecord
> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => unknown>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();

    constructor(
        public feature: T,
        public api: MapToProxyType<API>,
        public dependencies: RunningFeatures<Deps, string>
    ) {}

    public addRunHandler(fn: () => unknown, envName: string) {
        this.runHandlers.add(envName, fn);
    }
    public addOnDisposeHandler(fn: DisposeFunction, envName: string) {
        this.disposeHandlers.add(envName, fn);
    }
    public async [RUN](context: RuntimeEngine, envName: string): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;
        const runPromises: Array<unknown> = [];
        for (const dep of this.feature.dependencies) {
            runPromises.push(context.runFeature(dep, envName));
        }
        const envRunHandlers = this.runHandlers.get(envName) || [];
        for (const handler of envRunHandlers) {
            runPromises.push(handler());
        }
        await Promise.all(runPromises)
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
    ID extends string = string,
    Deps extends Feature[] = any[],
    API extends EntityRecord = any,
    EnvironmentContext extends Record<string, DisposableContext<any>> = any
> {
    public asEntity: Feature<ID, Feature[], API, EnvironmentContext> = this;
    public id: ID;
    public dependencies: Deps;
    public api: API;
    public context: EnvironmentContext;

    private environmentIml = new Set<string>();
    private setupHandlers = new SetMultiMap<string, SetupHandler<any, any, Deps, API, EnvironmentContext>>();
    private contextHandlers = new Map<string | number | symbol, ContextHandler<object, any, Deps>>();

    constructor(def: FeatureDef<ID, Deps, API, EnvironmentContext>) {
        this.id = def.id;
        this.dependencies = def.dependencies || (([] as Feature[]) as Deps);
        this.api = def.api || ({} as API);
        this.context = def.context || ({} as EnvironmentContext);
        this.identifyApis();
    }

    public setup<EnvFilter extends EnvironmentFilter>(
        env: EnvFilter,
        setupHandler: SetupHandler<EnvFilter, ID, Deps, API, EnvironmentContext>
    ): this {
        validateNoDuplicateEnvRegistration(env, this.id, this.environmentIml);
        this.setupHandlers.add(getEnvName(env), setupHandler);
        return this;
    }

    public use(config: PartialFeatureConfig<API>): [ID, PartialFeatureConfig<API>] {
        return [this.id, config];
    }

    public setupContext<K extends keyof EnvironmentContext, Env extends EnvironmentFilter>(
        _env: Env,
        environmentContext: K,
        contextHandler: ContextHandler<EnvironmentContext[K]['type'], Env, Deps>
    ) {
        validateNoDuplicateContextRegistration(environmentContext, this.id, this.contextHandlers);
        this.contextHandlers.set(environmentContext, contextHandler);
        return this;
    }

    public [CREATE_RUNTIME](runningEngine: RuntimeEngine, envName: string) {
        const deps: any = {};
        const depsApis: any = {};
        const runningApi: any = {};
        const inputApi: any = {};
        const providedAPI: any = {};
        const environmentContext: any = {};
        const apiEntries = Object.entries(this.api);
        const universalApiEntries = apiEntries.filter(
            ([_, entity]) => entity.mode !== 'input' && isGloballyProvided(entity.providedFrom)
        );
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
            [RUN_OPTIONS]: runningEngine.runOptions,
            runningEnvironmentName: envName,
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
            if (featureOutput) {
                for (const [key] of universalApiEntries) {
                    settingUpFeature[key] = (featureOutput as any)[key];
                }
                Object.assign(providedAPI, featureOutput);
            }
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
            const entityFn = api[IDENTIFY_API];
            if (entityFn) {
                entityFn.call(api, this.id, key);
            }
        }
    }
}

function validateNoDuplicateEnvRegistration(env: EnvironmentFilter, featureId: string, registered: Set<string>) {
    const hasCollision = testEnvironmentCollision(env, registered);
    if (hasCollision.length) {
        const collisions = hasCollision.join(', ');
        throw new Error(
            `Feature can only have single setup for each environment. ${featureId} Feature already implements: ${collisions}`
        );
    }
}

function validateNoDuplicateContextRegistration(
    environmentContext: string | number | symbol,
    featureId: string,
    contextHandlers: Map<string | number | symbol, ContextHandler<object, EnvironmentFilter, any>>
) {
    const registeredContext = contextHandlers.get(environmentContext);
    if (registeredContext) {
        throw new Error(
            `Feature can only have single setupContext for each context id. ${featureId} Feature already implements: ${String(
                environmentContext
            )}`
        );
    }
}
