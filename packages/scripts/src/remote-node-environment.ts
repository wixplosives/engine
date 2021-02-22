import { fork } from 'child_process';
import { once } from 'events';
import { ForkedProcess } from './forked-process';
import { ICommunicationMessage, isEnvironmentPortMessage, RemoteProcess } from './types';

export interface IStartRemoteNodeEnvironmentOptions {
    port: number;
    inspect?: boolean;
}

export async function startRemoteNodeEnvironment(
    entryFilePath: string,
    { inspect, port }: IStartRemoteNodeEnvironmentOptions
) {
    // Roman: add this lines after worker threads will be debuggable
    // the current behavior should be a fallback

    // try {
    // const WorkerThreadsModule = await import('worker_threads');
    // return new RemoteNodeEnvironment(new WorkerThreadsModule.Worker(entityFilePath, {}));
    // } catch {
    const execArgv = inspect ? ['--inspect'] : [];
    const childProc = fork(entryFilePath, ['remote', '-p', `${port}`], {
        execArgv,
    });
    await once(childProc, 'message');
    childProc.on('error', (e) => console.error(`error in forked process`, e));

    return new RemoteNodeEnvironment(new ForkedProcess(childProc));
}

export class RemoteNodeEnvironment {
    private messageHandlers = new Set<(message: ICommunicationMessage) => void>();

    constructor(private childEnv: RemoteProcess) {}

    public async getRemotePort(): Promise<number> {
        return new Promise((resolve) => {
            this.subscribe((message) => {
                if (isEnvironmentPortMessage(message)) {
                    resolve(message.payload.port);
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
        for (const handler of this.messageHandlers) {
            this.childEnv.off('message', handler);
        }
        this.messageHandlers.clear();
        if (this.childEnv && this.childEnv.terminate) {
            this.childEnv.terminate();
        }
    }
}
