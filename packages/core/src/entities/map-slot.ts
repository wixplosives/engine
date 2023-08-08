import { CREATE_RUNTIME } from '../symbols.js';
import type { EnvVisibility } from '../types.js';
import { FeatureInput } from './input.js';

export class MapRegistry<K, T> {
    private items: Map<K, T> = new Map<K, T>();

    private callbacks: Set<(key: K, item: T) => void> = new Set();

    public register(key: K, item: T) {
        this.items.set(key, item);
        for (const callback of this.callbacks) {
            callback(key, item);
        }
    }
    public [Symbol.iterator](): IterableIterator<[K, T]> {
        return this.items[Symbol.iterator]();
    }
    public subscribe(cb: (key: K, item: T) => void) {
        this.callbacks.add(cb);
    }
    public unSubscribe(cb: (key: K, item: T) => void) {
        this.callbacks.delete(cb);
    }
    public stream(cb: (key: K, item: T) => void) {
        for (const [key, value] of this) {
            cb(key, value);
        }
        this.subscribe(cb);
        return () => this.unSubscribe(cb);
    }
    public asMap(): ReadonlyMap<K, T> {
        return this.items;
    }
    public get(key: K) {
        return this.items.get(key);
    }
    public values() {
        return this.items.values();
    }
}

export class MapSlot<Type extends MapRegistry<any, any>, ProvidedFrom extends EnvVisibility> extends FeatureInput<
    Type,
    ProvidedFrom
> {
    public static withType<K, T>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(env: E_ENV) {
                return new MapSlot<MapRegistry<K, T>, E_ENV>(env, env);
            },
        };
    }
    public [CREATE_RUNTIME]() {
        return new MapRegistry() as Type;
    }
}
