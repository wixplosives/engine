import { MessagePort, Worker } from 'node:worker_threads';

import { BaseHost, IDisposable, Message } from '@wixc3/engine-core';

export class WorkerThreadHost extends BaseHost implements IDisposable {
    private disposed = false;

    constructor(private host: Worker | MessagePort) {
        super();
        host.on('message', this.onMessage);
    }

    public addEventListener(type: 'message', handler: (event: { data: any }) => void): void {
        const handlers = this.handlers.get(type);
        if (!handlers) {
            this.handlers.set(type, new Set([handler]));
        } else {
            handlers.add(handler);
        }

        this.host.addListener(type, handler);
    }

    public removeEventListener(type: 'message', handler: (event: { data: any }) => void): void {
        this.host.removeListener(type, handler);
    }

    public postMessage(data: Message): void {
        this.host.postMessage(data);
    }

    public dispose() {
        this.host.off('message', this.onMessage);
    }

    public isDisposed(): boolean {
        return this.disposed;
    }

    private onMessage: (...args: any[]) => void = (message) => {
        this.emitMessageHandlers(message);
    };
}
