export type PromiseResolveCb<T> = (value: T | PromiseLike<T>) => void;
export type PromiseRejectCb = (reason?: any) => void;

export interface IDeferredPromise<T> {
    promise: Promise<T>;
    resolve: PromiseResolveCb<T>;
    reject: PromiseRejectCb;
}

export function deferred<T = void>(): IDeferredPromise<T> {
    let resolve!: PromiseResolveCb<T>;
    let reject!: PromiseRejectCb;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}
