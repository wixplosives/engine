// we cannot mix types of "dom" and "webworker". tsc fails building.
declare let WorkerGlobalScope: new () => Worker;

export function isWorkerContext(target: unknown): target is Worker {
    return (
        (typeof Worker !== 'undefined' && target instanceof Worker) ||
        (typeof WorkerGlobalScope !== 'undefined' && target instanceof WorkerGlobalScope)
    );
}

export function isWindow(win: unknown): win is Window {
    return typeof Window !== 'undefined' && win instanceof Window;
}

export function isIframe(iframe: unknown): iframe is HTMLIFrameElement {
    return typeof HTMLIFrameElement !== 'undefined' && iframe instanceof HTMLIFrameElement;
}

export class MultiCounter {
    private ids: Record<string, number> = {};
    public next(ns: string) {
        this.ids[ns] = this.ids[ns] || 0;
        return `${ns}${this.ids[ns]++}`;
    }
}

const undefinedArgPlaceholder = '__|UND_ARG_PLA|__';

export const serializeApiCallArguments = (args: unknown[]): unknown[] =>
    args.map((arg) => (arg === undefined ? undefinedArgPlaceholder : arg));

export const deserializeApiCallArguments = (args: unknown[]): unknown[] =>
    args.map((arg) => (arg === undefinedArgPlaceholder ? undefined : arg));
