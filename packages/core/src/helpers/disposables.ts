export function createDisposables<Context extends unknown>() {
    const disposables = new Set<(disposeContext?: Context) => unknown>();

    return {
        async dispose(disposeContext?: Context) {
            const toDispose = new Set(Array.from(disposables).reverse());
            disposables.clear();
            for (const dispose of toDispose) {
                await dispose(disposeContext);
            }
        },
        add<T extends { dispose(disposeContext?: Context): unknown } | ((disposeContext?: Context) => unknown)>(
            disposable: T
        ): T {
            if (typeof disposable === 'function') {
                disposables.add(disposable);
            } else {
                disposables.add((params) => disposable.dispose(params));
            }
            return disposable;
        },
    };
}
