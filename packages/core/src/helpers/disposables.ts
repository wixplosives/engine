export function createDisposables() {
    const disposables = new Set<() => unknown>();

    return {
        async dispose() {
            const toDispose = new Set(Array.from(disposables).reverse());
            disposables.clear();
            for (const dispose of toDispose) {
                await dispose();
            }
        },
        add<T extends { dispose(): unknown } | (() => unknown)>(disposable: T): T {
            if (typeof disposable === 'function') {
                disposables.add(disposable);
            } else {
                disposables.add(() => disposable.dispose());
            }
            return disposable;
        },
    };
}
