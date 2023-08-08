import type { RuntimeEngine } from '../runtime-engine.js';
import { CONFIGURABLE, CREATE_RUNTIME, REGISTER_VALUE } from '../symbols.js';
import type { EnvVisibility } from '../types.js';
import { AllEnvironments, Environment } from './env.js';
import { FeatureInput } from './input.js';

export type MergeConfigHook<T extends object> = (a: Readonly<T>, b: Readonly<Partial<T>>) => T;

export class Config<T extends object, VisibleAt extends EnvVisibility = Environment> extends FeatureInput<
    T,
    Environment,
    VisibleAt
> {
    public static withType<T extends object>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(
                defaultValue: T,
                mergeConfig?: MergeConfigHook<T>,
                visibleAt?: E_ENV,
            ) {
                return new Config(defaultValue, mergeConfig, visibleAt);
            },
        };
    }

    public [CONFIGURABLE] = true as const;
    constructor(
        public defaultValue: T,
        public mergeConfig: MergeConfigHook<T> = (a: T, b: Partial<T>) => ({ ...a, ...b }),
        visibleAt = AllEnvironments as VisibleAt,
    ) {
        super(AllEnvironments, visibleAt);
    }

    public [CREATE_RUNTIME](context: RuntimeEngine, featureID: string, entityKey: string) {
        const topConfig = context.getTopLevelConfig(featureID, entityKey) as T[];
        return topConfig.reduce((current, next) => {
            return this.mergeConfig(current, next);
        }, this.defaultValue);
    }

    public [REGISTER_VALUE](
        _context: RuntimeEngine,
        _providedValue: undefined,
        inputValue: T,
        _featureID: string,
        _entityKey: string,
    ) {
        return inputValue;
    }
}
