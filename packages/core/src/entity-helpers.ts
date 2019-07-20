/**
 * Just a Symbol that is used as any type T at runtime.
 */
export function runtimeType<T>(name?: string): T {
    return (Symbol(name) as unknown) as T;
}
