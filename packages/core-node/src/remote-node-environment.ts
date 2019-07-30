import { ForkedProcess } from '@wixc3/engine-scripts/src/forked-process';
import { ICommunicationMessage, isPortMessage, RemoteProcess } from '@wixc3/engine-scripts/src/types';
import { fork } from 'child_process';

export class RemoteNodeEnvironment {
    private worker: RemoteProcess | undefined;
    private messageHandlers: Set<(message: ICommunicationMessage) => void> = new Set();

    constructor(private entityFilePath: string) {}

    public async start(): Promise<number> {
        return new Promise(async resolve => {
            this.worker = await this.startRemoteEnvironment(this.entityFilePath);
            this.subscribe((message: ICommunicationMessage): void => {
                if (isPortMessage(message)) {
                    resolve(message.port);
                }
            });
            this.postMessage({
                id: 'port'
            });
        });
    }

    public subscribe(handler: (message: ICommunicationMessage) => void) {
        if (!this.worker) {
            throw new Error('worker is not started');
        }
        if (!this.messageHandlers.has(handler)) {
            this.messageHandlers.add(handler);
            this.worker.on('message', handler);
        }
    }

    public unsubscribe(handler: (message: ICommunicationMessage) => void) {
        if (this.messageHandlers.has(handler)) {
            this.messageHandlers.delete(handler);
        }
    }

    public postMessage(message: ICommunicationMessage) {
        if (!this.worker) {
            throw new Error('worker is not started');
        }
        this.worker.postMessage(message);
    }

    public dispose() {
        if (this.worker) {
            this.worker.terminate!();
        }
    }

    private async startRemoteEnvironment(entryPath: string): Promise<RemoteProcess> {
        try {
            const WorkerThreadsModule = await import('worker_threads');
            return new WorkerThreadsModule.Worker(entryPath);
        } catch {
            const proc = fork(require.resolve(entryPath), [], { execArgv: [] });
            // tslint:disable-next-line: no-console
            proc.on('error', console.error);
            return new ForkedProcess(proc);
        }
    }
}
