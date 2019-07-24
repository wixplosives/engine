import { ChildProcess } from 'child_process';
import { ICommunicationMessage, RemoteProcess } from './types';

export class ForkedProcess implements RemoteProcess {
    constructor(private proc: NodeJS.Process | ChildProcess) {}

    public on(event: 'message', handler: (message: ICommunicationMessage) => unknown) {
        this.proc.on(event, handler);
    }

    public postMessage(message: ICommunicationMessage) {
        this.proc.send!(message);
    }

    public terminate() {
        if (this.proc.send) {
            (this.proc as ChildProcess).kill();
        }
    }
}
