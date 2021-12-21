import { BaseHost, IDisposable, Message } from '@wixc3/engine-core';
import type { ChildProcess } from 'child_process';

export class IPCHost extends BaseHost implements IDisposable {
    private disposed = false;
    private envs = new Set<string>();

    constructor(private process: NodeJS.Process | ChildProcess) {
        super();
        process.on('message', this.onMessage);
        process.once('disconnect', () => {
            process.off('message', this.onMessage);
            for (const env of this.envs) {
                this.emitMessageHandlers({
                    from: env,
                    type: 'dispose',
                    to: '*',
                    origin: env,
                });
            }
        });
    }

    private onMessage: (...args: any[]) => void = (message) => {
        this.emitMessageHandlers(message);
    };

    public postMessage(data: Message) {
        this.envs.add(data.to);
        if (!this.process.send) {
            throw new Error('this process is not forked. There is not to send message to');
        }
        try {
            this.process.send(data);
        } catch {
            // if the process.send command failed it means the target is not accessible
            this.emitMessageHandlers({
                from: data.to,
                type: 'dispose',
                to: '*',
                origin: data.to,
            });
        }
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
