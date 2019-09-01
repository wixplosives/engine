import { fork } from 'child_process';
import { ForkedProcess, ICommunicationMessage, isEnvironmentPortMessage, RemoteProcess } from '../src';

export interface IRemoteNodeEnvironmentOptions {
    inspect?: boolean;
}

export class RemoteNodeEnvironment {
    private childEnv: RemoteProcess;
    private messageHandlers = new Set<(message: ICommunicationMessage) => void>();

    constructor(private entryFilePath: string, options: IRemoteNodeEnvironmentOptions) {
        this.childEnv = this.startRemoteEnvironment(options);
    }

    public async getRemotePort(): Promise<number> {
        return new Promise(async resolve => {
            this.subscribe((message: ICommunicationMessage): void => {
                if (isEnvironmentPortMessage(message)) {
                    resolve(message.port);
                }
            });
            this.postMessage({ id: 'port-request' });
        });
    }

    public subscribe(handler: (message: ICommunicationMessage) => void) {
        this.messageHandlers.add(handler);
        this.childEnv.on('message', handler);
    }

    public unsubscribe(handler: (message: ICommunicationMessage) => void) {
        this.messageHandlers.delete(handler);
        this.childEnv.off('message', handler);
    }

    public postMessage(message: ICommunicationMessage) {
        this.childEnv.postMessage(message);
    }

    public dispose() {
        if (this.childEnv && this.childEnv.terminate) {
            this.childEnv.terminate();
        }
    }

    private startRemoteEnvironment({ inspect }: IRemoteNodeEnvironmentOptions): RemoteProcess {
        // Roman: add this lines after worker threads will be debuggable
        // the current behavior should be a fallback

        // try {
        // const WorkerThreadsModule = await import('worker_threads');
        // return new WorkerThreadsModule.Worker(this.entityFilePath, {});
        // } catch {
        const execArgv = inspect ? ['--inspect'] : [];
        const proc = fork(this.entryFilePath, [], { execArgv });
        // tslint:disable-next-line: no-console
        proc.on('error', console.error);
        return new ForkedProcess(proc);
        // }
    }
}
