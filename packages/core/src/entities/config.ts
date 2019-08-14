import { RuntimeEngine } from '../runtime-engine';
import { CREATE_RUNTIME, REGISTER_VALUE } from '../symbols';
import { EnvVisibility } from '../types';
import { AllEnvironments } from './env';
import { FeatureInput } from './input';

type MergeConfigHook<T extends object> = (a: Readonly<T>, b: Readonly<Partial<T>>) => T;

export class Config<T extends object, VisibleAt extends EnvVisibility = AllEnvironments> extends FeatureInput<
    Readonly<T>,
    AllEnvironments,
    VisibleAt
> {
    public static withType<T extends object>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(
                defaultValue: T,
                mergeConfig?: MergeConfigHook<T>,
                visibleAt?: E_ENV
            ) {
                return new Config(defaultValue, mergeConfig, visibleAt);
            }
        };
    }
    constructor(
        public defaultValue: Readonly<T>,
        public mergeConfig: MergeConfigHook<T> = (a: T, b: Partial<T>) => ({ ...a, ...b }),
        visibleAt = (AllEnvironments as unknown) as VisibleAt
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
        _entityKey: string
    ) {
        return inputValue;
    }
}
