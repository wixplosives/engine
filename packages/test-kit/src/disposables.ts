export function createDisposables() {
    const disposables: Array<() => unknown> = [];
    return {
        async dispose() {
            for (const dispose of disposables) {
                await dispose();
            }
            disposables.length = 0;
        },
        push(...toDispose: Array<() => unknown>) {
            disposables.push(...toDispose);
        }
    };
}
