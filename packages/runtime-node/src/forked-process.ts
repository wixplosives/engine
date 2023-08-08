import type { ChildProcess } from 'node:child_process';
import type { ICommunicationMessage, RemoteProcess } from './types.js';

export class ForkedProcess implements RemoteProcess {
    constructor(private proc: NodeJS.Process | ChildProcess) {}

    public on(event: 'message', handler: (message: ICommunicationMessage) => unknown) {
        this.proc.on(event, handler);
    }

    public off(event: 'message', handler: (message: ICommunicationMessage) => unknown) {
        this.proc.off(event, handler);
    }

    public postMessage(message: ICommunicationMessage) {
        if (this.proc.send) {
            this.proc.send(message);
        }
    }

    public terminate() {
        this.proc.removeAllListeners();
    }
}
