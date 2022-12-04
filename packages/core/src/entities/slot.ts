import { CREATE_RUNTIME } from '../symbols';
import type { EnvVisibility } from '../types';
import { FeatureInput } from './input';

export class Registry<T> {
    private items: T[] = [];
    private callbacks: Set<(item: T) => void> = new Set();
    public register(item: T) {
        this.items.push(item);
        for (const callback of this.callbacks) {
            callback(item);
        }
    }
    public [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
    public subscribe(cb: (item: T) => void) {
        this.callbacks.add(cb);
    }
    public unSubscribe(cb: (item: T) => void) {
        this.callbacks.delete(cb);
    }
    public asArray(): ReadonlyArray<T> {
        return this.items;
    }
    public stream(cb: (item: T) => void) {
        for (const item of this) {
            cb(item);
        }
        this.subscribe(cb);
        return () => this.unSubscribe(cb);
    }
}

/**
 * Set of user typed values, consumed at any flow that requires this feature.
 *
 * @example
 * Slot.withType<IUser>().defineEntity('main')
 */
export class Slot<Type extends Registry<any>, ProvidedFrom extends EnvVisibility> extends FeatureInput<
    Type,
    ProvidedFrom
> {
    /**
     * Provides the actual interface of each unit of the slot
     */
    public static withType<T>() {
        return {
            /**
             * Which env the slot will be assigned to.
             * @param env instance of the environment that the slot will be set upon
             */
            defineEntity<E_ENV extends EnvVisibility>(env: E_ENV) {
                return new Slot<Registry<T>, E_ENV>(env, env);
            }
        };
    }
    public [CREATE_RUNTIME]() {
        return new Registry() as Type;
    }
}
