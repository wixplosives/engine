import { CREATE_RUNTIME } from '../symbols.js';
import type { EnvVisibility } from '../types.js';
import { FeatureInput } from './input.js';

type Param<T, K extends keyof T> = K extends any ? [K, boolean | Array<T[K]>] : never;

export type SlotOrdering<T> = ReadonlyArray<Param<T, keyof T>>;

function getItemOrder<A>(sortingOrder: A[], item: A) {
    const index = sortingOrder.indexOf(item);
    return index < 0 ? Infinity : index;
}

function compareAny(a: any, b: any): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

type Compare<T> = (a: T, b: T) => number;

function composeCompare<T>(f: Compare<T>, g: Compare<T>): Compare<T> {
    return (a: T, b: T) => {
        const r = f(a, b);
        return r || g(a, b);
    };
}

const { hasOwnProperty } = Object.prototype;

function mkCompare<T>(params: SlotOrdering<T>): Compare<T> {
    let func: Compare<T> = (_a: T, _b: T) => 0;
    // eslint-disable-next-line @typescript-eslint/no-for-in-array
    for (const p in params) {
        if (hasOwnProperty.call(params, p)) {
            const [key, mode] = params[p]!;
            if (mode === true) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                func = composeCompare<T>(func, (a: any, b: any) => compareAny(b[key], a[key]));
            } else if (mode === false) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                func = composeCompare<T>(func, (a: any, b: any) => compareAny(a[key], b[key]));
            } else {
                func = composeCompare<T>(
                    func,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    (a: any, b: any) => getItemOrder(mode, a[key]) - getItemOrder(mode, b[key]),
                );
            }
        }
    }
    return func;
}

export class OrderedRegistry<T extends object> {
    private items: T[] = [];
    private callbacks: Set<(item: T) => void> = new Set();
    public register(item: T) {
        this.items.push(item);
        this.sortItems();
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
    public setItems(items: T[]) {
        this.items = items;
        this.sortItems();
        return this;
    }
    public setSortingOrder(order: ReadonlyArray<Param<T, keyof T>>) {
        this.compareFunction = mkCompare(order);
        this.sortItems();
        return this;
    }
    protected compareFunction: Compare<T> = (_a: T, _b: T) => 0;

    private sortItems() {
        this.items.sort(this.compareFunction);
    }
}

export class OrderedSlot<Type extends OrderedRegistry<any>, ProvidedFrom extends EnvVisibility> extends FeatureInput<
    Type,
    ProvidedFrom
> {
    public static withType<T extends object>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(env: E_ENV) {
                return new OrderedSlot<OrderedRegistry<T>, E_ENV>(env, env);
            },
        };
    }
    public [CREATE_RUNTIME]() {
        return new OrderedRegistry() as Type;
    }
}
