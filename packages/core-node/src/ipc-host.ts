import { BaseHost, IDisposable } from '@wixc3/engine-core';
import { ChildProcess } from 'child_process';

export class IPCHost extends BaseHost implements IDisposable {
    private disposed = false;

    constructor(private prcocess: NodeJS.Process | ChildProcess) {
        super();
        prcocess.on('message', this.onMessage);
        prcocess.once('disconnect', () => prcocess.off('message', this.onMessage));
    }

    private onMessage: (...args: any[]) => void = message => {
        this.emitMessageHandlers(message);
    };

    public postMessage(data: any) {
        if (this.prcocess.send) {
            this.prcocess.send(data);
        }
    }

    public dispose() {
        this.handlers.clear();
        this.prcocess.removeAllListeners();
        this.disposed = true;
    }

    public isDisposed() {
        return this.disposed;
    }
}
