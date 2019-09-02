import { fork } from 'child_process';
import { ForkedProcess, ICommunicationMessage, isEnvironmentPortMessage, RemoteProcess } from '../src';

export interface IRemoteNodeEnvironmentOptions {
    port: number;
    inspect?: boolean;
}

export class RemoteNodeEnvironment {
    private childEnv: RemoteProcess | undefined;
    private messageHandlers = new Set<(message: ICommunicationMessage) => void>();

    constructor(private entryFilePath: string, private options: IRemoteNodeEnvironmentOptions) {}

    public async getRemotePort(): Promise<number> {
        await this.init();
        if (!this.childEnv) {
            throw new Error('Remote environment is not running');
        }

        return new Promise(async resolve => {
            this.subscribe(message => {
                if (isEnvironmentPortMessage(message)) {
                    resolve(message.port);
                }
            });
            this.postMessage({ id: 'port-request' });
        });
    }

    public subscribe(handler: (message: ICommunicationMessage) => void) {
        if (!this.childEnv) {
            throw new Error('Remote environment is not running');
        }
        this.messageHandlers.add(handler);
        this.childEnv.on('message', handler);
    }

    public unsubscribe(handler: (message: ICommunicationMessage) => void) {
        if (!this.childEnv) {
            throw new Error('Remote environment is not running');
        }
        this.messageHandlers.delete(handler);
        this.childEnv.off('message', handler);
    }

    public postMessage(message: ICommunicationMessage) {
        if (!this.childEnv) {
            throw new Error('Remote environment is not running');
        }
        this.childEnv.postMessage(message);
    }

    public dispose() {
        if (!this.childEnv) {
            return;
        }
        for (const handler of this.messageHandlers) {
            this.childEnv.off('message', handler);
        }
        this.messageHandlers.clear();
        if (this.childEnv && this.childEnv.terminate) {
            this.childEnv.terminate();
        }
    }

    private async init() {
        return new Promise(resolve => {
            this.childEnv = this.startRemoteEnvironment(this.options);
            this.subscribe(message => {
                if (message.id === 'init') {
                    resolve();
                }
            });
        });
    }

    private startRemoteEnvironment({ inspect, port }: IRemoteNodeEnvironmentOptions): RemoteProcess {
        // Roman: add this lines after worker threads will be debuggable
        // the current behavior should be a fallback

        // try {
        // const WorkerThreadsModule = await import('worker_threads');
        // return new WorkerThreadsModule.Worker(this.entityFilePath, {});
        // } catch {
        const execArgv = inspect ? ['--inspect'] : [];
        const proc = fork(this.entryFilePath, ['remote', '-p', `${port}`], { execArgv });
        // tslint:disable-next-line: no-console
        proc.on('error', console.error);
        return new ForkedProcess(proc);
        // }
    }
}
