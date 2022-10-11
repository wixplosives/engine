import { isPlainObject, same, isSetMultiMap, SetMultiMap, concat, isMap, isSet } from "@wixc3/common"

export function mergeResults<K, V>(a: Map<K, V>, b: Map<K, V>): Map<K, V>;
export function mergeResults<V>(a: Set<V>, b: Set<V>): Set<V>;
export function mergeResults<K, V>(a: SetMultiMap<K, V>, b: SetMultiMap<K, V>): SetMultiMap<K, V>;
export function mergeResults<M extends object>(a: M, b: M): M;
export function mergeResults<M extends Map<K, V> | Set<V> | SetMultiMap<K, V> | object, K, V>(a: M, b: M): M {
    if (isMap(a) && isMap(b)) {
        return new Map<K, V>(concat(a,b)) as M
    }
    if (isSet(a) && isSet(b)) {
        return new Set<K>(concat(a,b)) as M
    }
    if (isSetMultiMap<K, V>(a) && isSetMultiMap<K, V>(b)) {
        const merged = new SetMultiMap<K, V>(concat(a,b))
        return merged as M
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const merged = {} as any
        const ar = a as any
        const br = b as any
        const keys = new Set(concat(Object.keys(a), Object.keys(a)))

        keys.forEach(key => {
            merged[key] = (ar[key] && br[key]
                ? mergeResults(ar[key]!, br[key]!)
                : ar[key] || br[key])
        })
        return merged as M
    }
    return b ?? a
}
