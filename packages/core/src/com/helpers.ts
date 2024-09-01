// we cannot mix types of "dom" and "webworker". tsc fails building.
import type { AnyServiceMethodOptions } from './types';
import type { Message } from './message-types';
import { SetMultiMap } from '@wixc3/patterns';

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

export function declareComEmitter<T>(
    onMethod: keyof T,
    offMethod: keyof T,
    removeAll?: keyof T,
): Record<string, AnyServiceMethodOptions> {
    if (typeof onMethod !== 'string') {
        throw new Error('onMethod ref must be a string');
    }
    return {
        [onMethod]: { listener: true },
        [offMethod]: { removeListener: onMethod },
        ...(removeAll ? { [removeAll]: { removeAllListeners: onMethod } } : undefined),
    };
}

export const isListenCall: (args: unknown[]) => boolean = (args) => typeof args[0] === 'function' && args.length === 1;

export const redactArguments = <T extends Message['type']>(message: Extract<Message, { type: T }>) => {
    if (
        'data' in message &&
        typeof message.data === 'object' &&
        message.data !== null &&
        'args' in message.data &&
        Array.isArray(message.data.args)
    ) {
        return {
            ...message,
            data: {
                ...message.data,
                args: message.data.args.map(() => '███ARGUMENT███'),
            },
        };
    }
    return message;
};

export const countValues = (set: SetMultiMap<string, unknown>) => {
    const result: Record<string, number> = {};
    // SetMultiMap iterator is [key, value] and not [key, Set<value>]
    for (const [key] of set) {
        result[key] ??= 0;
        result[key]++;
    }
    return result;
};

export const quote = (message: Message): string => JSON.stringify(redactArguments(message), null, 2);
