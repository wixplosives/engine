import { RuntimeEngine } from '..';
import { CONFIGURABLE, CREATE_RUNTIME } from '../symbols';
import { EnvVisibility } from '../types';
import { FeatureInput } from './input';

const mergeConfig = <T>(a: T, b: Partial<T>) => ({ ...a, ...b });
export interface Identifiable {
    id: string;
}


export class ConfigurableSlotRegistry<T extends Identifiable> {
    private items: T[] = [];
    private sortOrder: string[] | undefined;
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

    public setSortingOrder(order: string[]) {
        this.sortOrder = order;
        this.sortItems();
        return this;
    }

    private getItemIndex(item: T) {
        if (!this.sortOrder) {
            return Number.MAX_SAFE_INTEGER;
        }
        const idx = this.sortOrder.findIndex(val => val === item.id);
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    }
    private sortItems() {
        if (!this.sortOrder) {
            return;
        }
        this.items.sort((item1, item2) => {
            const idx1 = this.getItemIndex(item1);
            const idx2 = this.getItemIndex(item2);
            return idx1 > idx2 ? 1 : -1;
        });
    }
}


export class ConfgurableSlot<Type extends ConfigurableSlotRegistry<any>, ProvidedFrom extends EnvVisibility> extends FeatureInput<
    Type,
    ProvidedFrom
    > {
    public static withType<T extends Identifiable>() {
        return {
            defineEntity<E_ENV extends EnvVisibility>(env: E_ENV) {
                return new ConfgurableSlot<ConfigurableSlotRegistry<T>, E_ENV>(env, env);
            }
        };
    }
    public defaultValue: string[] = [];
    public [CONFIGURABLE]: { order: string[] };
    public [CREATE_RUNTIME](context: RuntimeEngine, featureID: string, entityKey: string) {
        const topConfig = context.getTopLevelConfig(featureID, entityKey);
        const config = topConfig.reduce((current, next) => {
            return mergeConfig(current, next);
        }, this.defaultValue) as { order: string[] };
        const reg = new ConfigurableSlotRegistry() as Type;
        reg.setSortingOrder(config.order);
        return reg;
    }
}
