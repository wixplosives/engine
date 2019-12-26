export class SetMultiMap<K, V> implements Iterable<[K, V]> {
    private map: Map<K, Set<V>> = new Map();

    public get size(): number {
        return Array.from(this.map.values())
            .map(({ size }) => size)
            .reduce((sum, size) => sum + size, 0);
    }

    public get(key: K): ReadonlySet<V> | undefined {
        return this.map.get(key);
    }

    public add(key: K, value: V): this {
        const valueSet = this.map.get(key);
        if (valueSet) {
            valueSet.add(value);
        } else {
            this.map.set(key, new Set([value]));
        }
        return this;
    }

    public clear(): void {
        this.map.clear();
    }

    public delete(key: K, value: V): boolean {
        const valueSet = this.map.get(key);
        if (valueSet) {
            const wasInSet = valueSet.delete(value);
            if (valueSet.size === 0) {
                this.map.delete(key);
            }
            return wasInSet;
        }
        return false;
    }

    public deleteKey(key: K): boolean {
        return this.map.delete(key);
    }

    public has(key: K, value: V): boolean {
        const valueSet = this.map.get(key);
        return valueSet ? valueSet.has(value) : false;
    }

    public hasKey(key: K): boolean {
        const existingSet = this.map.get(key);
        return !!existingSet && existingSet.size > 0;
    }

    public [Symbol.iterator](): IterableIterator<[K, V]> {
        return this.entries();
    }

    public *entries(): IterableIterator<[K, V]> {
        const { map } = this;
        for (const [key, valueSet] of map.entries()) {
            for (const value of valueSet) {
                yield [key, value];
            }
        }
    }

    public *values(): IterableIterator<V> {
        const { map } = this;
        for (const valueSet of map.values()) {
            for (const value of valueSet) {
                yield value;
            }
        }
    }

    public keys(): IterableIterator<K> {
        return this.map.keys();
    }
}
