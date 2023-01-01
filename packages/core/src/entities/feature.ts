/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { Context, EntityRecord, FeatureDef, PartialFeatureConfig } from '../types';
import type { AnyEnvironment } from './env';
import {
    ContextHandler,
    createRuntimeInfo,
    FeatureDependencies,
    SetupHandler,
    validateNoDuplicateContextRegistration,
    validateNoDuplicateEnvRegistration,
} from './feature-descriptor';

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
    Deps extends FeatureDependencies = FeatureDependencies,
    API extends EntityRecord = EntityRecord,
    EnvironmentContext extends Record<string, Context<any>> = Record<string, Context<any>>
> {
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

    public runtimeInfo = createRuntimeInfo();
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
        this.dependencies = def.dependencies || ([] as unknown as Deps);
        this.api = def.api || ({} as API);
        this.context = def.context || ({} as EnvironmentContext);
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
    public setup<ENV extends AnyEnvironment>(env: ENV, setupHandler: SetupHandler<this, ENV>): this {
        validateNoDuplicateEnvRegistration(env, this.id, this.runtimeInfo.envs);
        this.runtimeInfo.setups.add(env.env, setupHandler);
        return this;
    }
    public use(config: PartialFeatureConfig<API>): [ID, PartialFeatureConfig<API>] {
        return [this.id, config];
    }

    public setupContext<K extends keyof EnvironmentContext & string, Env extends AnyEnvironment>(
        _env: Env,
        environmentContext: K,
        contextHandler: ContextHandler<this, Env, K>
    ) {
        validateNoDuplicateContextRegistration(environmentContext, this.id, this.runtimeInfo.contexts);
        this.runtimeInfo.contexts.set(environmentContext, contextHandler);
        return this;
    }
}
