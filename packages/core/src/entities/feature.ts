/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, DISPOSE, IDENTIFY_API, REGISTER_VALUE, RUN, RUN_OPTIONS } from '../symbols';
import type {
    ContextHandler,
    DisposableContext,
    DisposeFunction,
    EntityRecord,
    FeatureDef,
    Running,
    PartialFeatureConfig,
    RunningFeatures,
    SetupHandler,
    ReferencedEnvironments,
} from '../types';
import { AnyEnvironment, Environment, testEnvironmentCollision } from './env';
import { deferred, IDeferredPromise, SetMultiMap } from '../helpers';

const emptyDispose = { dispose: () => undefined };

/*************** FEATURE ***************/
export class RuntimeFeature<T extends Feature, ENV extends AnyEnvironment> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => unknown>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();
    private disposing: IDeferredPromise<void> | undefined;

    constructor(
        public feature: T,
        public api: Running<T, ReferencedEnvironments<ENV>>,
        public dependencies: RunningFeatures<T['dependencies'], ReferencedEnvironments<ENV>>
    ) {}

    public addRunHandler(fn: () => unknown, envName: string) {
        this.runHandlers.add(envName, fn);
    }
    public addOnDisposeHandler(fn: DisposeFunction, envName: string) {
        this.disposeHandlers.add(envName, fn);
    }
    public async [RUN](context: RuntimeEngine): Promise<void> {
        if (this.running) {
            return;
        }
        this.running = true;
        const runPromises: Array<unknown> = [];
        for (const envName of context.referencedEnvs) {
            for (const dep of this.feature.dependencies) {
                runPromises.push(context.runFeature(dep));
            }
            const envRunHandlers = this.runHandlers.get(envName) || [];
            for (const handler of envRunHandlers) {
                runPromises.push(handler());
            }
        }

        await Promise.all(runPromises);
    }

    public async [DISPOSE](context: RuntimeEngine) {
        const {
            entryEnvironment: { env: envName },
        } = context;
        if (this.disposing) {
            return this.disposing.promise;
        }
        this.disposing = deferred();
        for (const dep of this.feature.dependencies) {
            await context.dispose(dep);
        }
        const featureDisposeHandlers = this.disposeHandlers.get(envName) || new Set();
        for (const handler of featureDisposeHandlers) {
            await handler();
        }
        return this.disposing.resolve();
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
        this.dependencies = def.dependencies || ([] as Feature[] as Deps);
        this.api = def.api || ({} as API);
        this.context = def.context || ({} as EnvironmentContext);
        this.identifyApis();
    }

    public setup<ENV extends AnyEnvironment>(
        env: ENV,
        setupHandler: SetupHandler<ENV, ID, Deps, API, EnvironmentContext>
    ): this {
        validateNoDuplicateEnvRegistration(env, this.id, this.environmentIml);
        this.setupHandlers.add(env.env, setupHandler);
        return this;
    }

    public use(config: PartialFeatureConfig<API>): [ID, PartialFeatureConfig<API>] {
        return [this.id, config];
    }

    public setupContext<K extends keyof EnvironmentContext, Env extends AnyEnvironment>(
        _env: Env,
        environmentContext: K,
        contextHandler: ContextHandler<EnvironmentContext[K]['type'], Env, Deps>
    ) {
        validateNoDuplicateContextRegistration(environmentContext, this.id, this.contextHandlers);
        this.contextHandlers.set(environmentContext, contextHandler);
        return this;
    }

    public [CREATE_RUNTIME]<ENV extends AnyEnvironment>(runningEngine: RuntimeEngine<ENV>): RuntimeFeature<this, ENV> {
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
        const apiEntries = Object.entries(this.api);

        const feature = new RuntimeFeature<this, ENV>(this, runningApi, deps);

        features.set(this, feature);

        for (const dep of this.dependencies) {
            deps[dep.id] = runningEngine.initFeature(dep);
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
            [RUN_OPTIONS]: runOptions,
            runningEnvironmentName: envName,
        };

        for (const [key, contextHandler] of this.contextHandlers) {
            environmentContext[key] = { ...emptyDispose, ...contextHandler(depsApis) };
        }

        for (const envName of referencedEnvs) {
            const environmentSetupHandlers = this.setupHandlers.get(envName);
            if (!environmentSetupHandlers) {
                continue;
            }
            for (const setupHandler of environmentSetupHandlers) {
                const featureOutput = setupHandler(settingUpFeature, depsApis, environmentContext);
                if (!featureOutput) {
                    continue;
                }
                for (const key of Object.keys(featureOutput)) {
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

function validateNoDuplicateEnvRegistration(env: AnyEnvironment, featureId: string, registered: Set<string>) {
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
    contextHandlers: Map<string | number | symbol, ContextHandler<object, Environment, any>>
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
