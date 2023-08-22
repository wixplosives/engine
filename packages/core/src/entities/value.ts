import type { RuntimeEngine } from '../runtime-engine.js';
import { CREATE_RUNTIME, REGISTER_VALUE } from '../symbols.js';
import type { EnvVisibility } from '../types.js';
import { FeatureOutput } from './output.js';

export class Value<T, ProvidedFrom extends EnvVisibility> extends FeatureOutput<
    T,
    T,
    ProvidedFrom,
    ProvidedFrom,
    false
> {
    public static withType<T>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(providedFrom: E_ENV) {
                return new Value<T, E_ENV>(providedFrom);
            },
        };
    }
    private constructor(public providedFrom: ProvidedFrom) {
        super(providedFrom, providedFrom, false);
    }

    public [REGISTER_VALUE](_: RuntimeEngine, providedValue: T) {
        return providedValue;
    }

    public [CREATE_RUNTIME]() {
        return;
    }
}
