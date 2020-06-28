import { BaseHost, IDisposable } from '@wixc3/engine-core';
import type { ChildProcess } from 'child_process';

export class IPCHost extends BaseHost implements IDisposable {
    private disposed = false;

    constructor(private process: NodeJS.Process | ChildProcess) {
        super();
        process.on('message', this.onMessage);
        process.once('disconnect', () => process.off('message', this.onMessage));
    }

    private onMessage: (...args: any[]) => void = (message) => {
        this.emitMessageHandlers(message);
    };

    public postMessage(data: any) {
        if (!this.process.send) {
            throw new Error('this process is not forked. There is not to send message to');
        }
        this.process.send(data);
    }

    public dispose() {
        this.handlers.clear();
        this.process.removeAllListeners();
        this.disposed = true;
    }

    public isDisposed() {
        return this.disposed;
    }
}
