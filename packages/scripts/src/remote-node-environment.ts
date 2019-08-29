import { fork } from 'child_process';
import { ForkedProcess } from '../src';
import { ICommunicationMessage, isEnvironmentPortMessage, RemoteProcess } from '../src/types';

export class RemoteNodeEnvironment {
    private childEnv: RemoteProcess | undefined;
    private messageHandlers: Set<(message: ICommunicationMessage) => void> = new Set();

    constructor(private entityFilePath: string) {}

    public async start(inspect: boolean = false): Promise<number> {
        return new Promise(async resolve => {
            this.childEnv = this.startRemoteEnvironment(inspect);
            this.subscribe((message: ICommunicationMessage): void => {
                if (isEnvironmentPortMessage(message)) {
                    resolve(message.port);
                }
            });
            this.postMessage({
                id: 'port'
            });
        });
    }

    public subscribe(handler: (message: ICommunicationMessage) => void) {
        if (!this.childEnv) {
            throw new Error('worker is not started');
        }
        if (!this.messageHandlers.has(handler)) {
            this.messageHandlers.add(handler);
            this.childEnv.on('message', handler);
        }
    }

    public unsubscribe(handler: (message: ICommunicationMessage) => void) {
        if (this.messageHandlers.has(handler)) {
            this.messageHandlers.delete(handler);
        }
    }

    public postMessage(message: ICommunicationMessage) {
        if (!this.childEnv) {
            throw new Error('worker is not started');
        }
        this.childEnv.postMessage(message);
    }

    public dispose() {
        if (this.childEnv && this.childEnv.terminate) {
            this.childEnv.terminate();
        }
    }

    private startRemoteEnvironment(inspect: boolean): RemoteProcess {
        // Roman: add this lines after worker threads will be debuggable
        // the current behavior should be a fallback

        // try {
        // const WorkerThreadsModule = await import('worker_threads');
        // return new WorkerThreadsModule.Worker(this.entityFilePath, {});
        // } catch {
        const execArgv = inspect ? ['--inspect'] : [];
        const proc = fork(require.resolve(this.entityFilePath), [], { execArgv });
        // tslint:disable-next-line: no-console
        proc.on('error', console.error);
        return new ForkedProcess(proc);
        // }
    }
}
