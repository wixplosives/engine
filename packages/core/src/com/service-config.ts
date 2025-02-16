import type { AnyFunction, FilterFirstArgument, ValuePromise } from './types.js';

export function multiTenantMethod<T extends AnyFunction>(method: T) {
    if (!(typeof method === 'function')) {
        throw new Error('No Such function');
    }
    return (context: any) => {
        function getArgs([_first, ...rest]: Parameters<T>) {
            return rest as FilterFirstArgument<T>;
        }
        function proxyFunction(...args: ReturnType<typeof getArgs>): ValuePromise<ReturnType<T>> {
            return method.call(context, ...args) as ValuePromise<ReturnType<T>>;
        }
        return {
            getArgs,
            proxyFunction,
        };
    };
}
