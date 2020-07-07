import type { Target } from '../types';

export class BaseHost implements Target {
    public name = 'base-host';
    public parent: BaseHost | undefined = undefined;
    protected handlers = new Map<'message', Set<(e: { data: any }) => void>>();
    public addEventListener(name: 'message', handler: (e: { data: any }) => void, _capture?: boolean) {
        const handlers = this.handlers.get(name);
        if (!handlers) {
            this.handlers.set(name, new Set([handler]));
        } else {
            handlers.add(handler);
        }
    }
    public removeEventListener(name: 'message', handler: (e: { data: any }) => void, _capture?: boolean) {
        const handlers = this.handlers.get(name);
        if (handlers) {
            handlers.delete(handler);
        }
    }
    public postMessage(message: any) {
        this.emitMessageHandlers(message);
    }
    public open() {
        const host = new BaseHost();
        host.parent = this;
        return host;
    }
    protected emitMessageHandlers(message: any) {
        for (const hander of this.handlers.get('message') || []) {
            hander({ data: message });
        }
    }
}
