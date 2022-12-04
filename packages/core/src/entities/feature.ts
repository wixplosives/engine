/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, DISPOSE, ENGINE, IDENTIFY_API, REGISTER_VALUE, RUN, RUN_OPTIONS } from '../symbols';
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
    IFeature,
    Dependency
} from '../types';
import { AnyEnvironment, Environment, testEnvironmentCollision } from './env';
import { SetMultiMap } from '@wixc3/patterns';
import { deferred, IDeferredPromise } from 'promise-assist';

const emptyDispose = { dispose: () => undefined };

/**
 * Represents a currently running feature instance.
 **/
export class RuntimeFeature<T extends IFeature, ENV extends AnyEnvironment> {
    private running = false;
    private runHandlers = new SetMultiMap<string, () => unknown>();
    private disposeHandlers = new SetMultiMap<string, DisposeFunction>();
    private disposing: IDeferredPromise<void> | undefined;

    constructor(
        public feature: T,
        public api: Running<T, ENV>,
        public dependencies: RunningFeatures<T['dependencies'], ENV>
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
            entryEnvironment: { env: envName }
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

/**
 * Feature instances define an area of functionality of an app.
 * Each has a unique string ID, and may expose a public API containing services and slots.
 * It also contains a list of all dependencies, meaning other Feature instances, to use their APIs.
 *
 * When calling `runEngineApp` and providing it with a Feature[], it uses the definitions
 * to initialize a `RuntimeFeature` for each.
 *
 * @typeParam ID - Unique string identity
 * @typeParam Deps - Dependencies needed by this Feature (to consume their API)
 * @typeParam API - Entities (Slots, Services, etc.) this Feature exposes for other Features to consume.
 * @typeParam EnvironmentContext - Environment-specific APIs consumed by this feature
 */
export class Feature<
    ID extends string = string,
    Deps extends Dependency[] = any[],
    API extends EntityRecord = any,
    EnvironmentContext extends Record<string, DisposableContext<any>> = any
> {
    /**
     * References `this` without the exact types of `Deps` (making them a generic `Feature[]`).
     * We use `someFeature.asEntity` instead of `someFeature` when we want to avoid typescript
     * inlining these types during inference of `.d.ts` files.
     *
     * Mainly used where a Feature has dependencies:
     * ```ts
     * new Feature({
     *    id: 'someFeature',
     *    dependencies: [anotherFeature.asDependency],
     *    api: { ... },
     * })
     * ```
     */
    public asDependency = this as unknown as Dependency<ID, API, EnvironmentContext>;

    /**
     * Unique string that identifies the feature.
     */
    public id: ID;

    /**
     * `Feature[]` this Feature depends on and can consume their API
     */
    public dependencies: Deps;

    /**
     * Engine entities (Slot, Service, etc.) this Feature exposes to other Features depending on it.
     * This is a record with the key being the name of the api and the value being the definition.
     */
    public api: API;

    /**
     * Environment-specific APIs consumed by this feature
     */
    public context: EnvironmentContext;

    private environmentIml = new Set<string>();
    private setupHandlers = new SetMultiMap<string, SetupHandler<any, any, Deps, API, EnvironmentContext>>();
    private contextHandlers = new Map<string | number | symbol, ContextHandler<object, any, Deps>>();

    /**
     * Define a new feature by providing:
     * - Unique string identifier
     * - API
     * - Dependencies (optional)
     * - Context (optional)
     *
     * This instance will be detected by engine when exported as default, as well as being used
     * by `<feature-name>.<environment-name>.env.ts` files to define the environment specific implementations.
     *
     * @example
     * ```
     * export default new Feature({
     *   id: 'my-feature',
     *   api: { ... },
     * })
     * ```
     */
    constructor(def: FeatureDef<ID, Deps, API, EnvironmentContext>) {
        this.id = def.id;
        this.dependencies = def.dependencies || ([] as Dependency[] as Deps);
        this.api = def.api || ({} as API);
        this.context = def.context || ({} as EnvironmentContext);
        this.identifyApis();
    }

    /**
     * Call this to provide the environment specific implementation for a feature.
     *
     * @param env Environment id to implement the api for.
     * @param setupHandler Callback that receives:
     * - Own feature `Slot`s
     * - Dependencies APIs
     * - Context API that is specific to a runtime environment.
     *
     * @returns Implementation for the services defined for this feature on this environment
     */
    public setup<ENV extends AnyEnvironment>(
        env: ENV,
        setupHandler: SetupHandler<ENV, ID, Deps, API, EnvironmentContext>
    ): this {
        validateNoDuplicateEnvRegistration(env, this.id, this.environmentIml);
        this.setupHandlers.add(env.env, setupHandler);
        return this;
    }

    /**
     *
     *
     * @param config
     * @returns
     */
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
            entryEnvironment: { env: envName }
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
            [ENGINE]: runningEngine,
            runningEnvironmentName: envName
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
                for (const [key, value] of Object.entries(featureOutput)) {
                    settingUpFeature[key] = value;
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
