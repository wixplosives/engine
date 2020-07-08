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
    public stream(cb: (item: T) => void) {
        for (const item of this) {
            cb(item);
        }
        this.subscribe(cb);
        return () => this.unSubscribe(cb);
    }
}

export class Slot<Type extends Registry<any>, ProvidedFrom extends EnvVisibility> extends FeatureInput<
    Type,
    ProvidedFrom
> {
    public static withType<T>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(env: E_ENV) {
                return new Slot<Registry<T>, E_ENV>(env, env);
            },
        };
    }
    public [CREATE_RUNTIME]() {
        return new Registry() as Type;
    }
}
