export interface IDisposables {
    dispose(): Promise<void>;
    add(toDispose: () => unknown): void;
    add(message: string, toDispose: () => unknown): void;
}

export function createDisposables(): IDisposables {
    const disposables: Array<() => unknown> = [];
    return {
        async dispose() {
            for (const dispose of disposables) {
                await dispose();
            }
            disposables.length = 0;
        },
        add(message: string | (() => unknown), toDispose?: () => unknown) {
            if (typeof message === 'string') {
                // tslint:disable-next-line: no-console
                console.log(message);
                disposables.push(toDispose!);
            } else {
                disposables.push(message);
            }
        }
    };
}
