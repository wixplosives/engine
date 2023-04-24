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

const undefinedPlaceholder = '__undefined_placeholder__';

/**
 * Serialization/deserialization is needed in order to fix the issue with undefined arguments in remote API calls:
 * https://github.com/wixplosives/engine/issues/1434
 */
export const serializeApiCallArguments = (args: unknown[]): unknown[] =>
    args.map((arg) => (arg === undefined ? undefinedPlaceholder : arg));

export const deserializeApiCallArguments = (args: unknown[]): unknown[] =>
    args.map((arg) => (arg === undefinedPlaceholder ? undefined : arg));
