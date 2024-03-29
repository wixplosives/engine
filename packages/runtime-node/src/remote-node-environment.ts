import { fork } from 'node:child_process';
import { once } from 'node:events';
import type { ServerOptions } from 'socket.io';
import { ForkedProcess } from './forked-process.js';
import { isEnvironmentPortMessage, type ICommunicationMessage, type RemoteProcess } from './types.js';
import { IDisposable, SafeDisposable } from '@wixc3/patterns';

export interface IStartRemoteNodeEnvironmentOptions {
    port: number;
    inspect?: boolean;
    socketServerOptions?: Partial<ServerOptions>;
    requiredPaths?: string[];
}

export async function startRemoteNodeEnvironment(
    entryFilePath: string,
    { inspect, port, socketServerOptions = {}, requiredPaths = [] }: IStartRemoteNodeEnvironmentOptions,
) {
    const execArgv = inspect && !process.execArgv.includes('--inspect') ? ['--inspect'] : [];

    const childProccess = fork(
        entryFilePath,
        [
            '--preferredPort',
            `${port}`,
            '--socketServerOptions',
            JSON.stringify(socketServerOptions),
            '--requiredPaths',
            JSON.stringify(requiredPaths),
        ],
        {
            execArgv: [...process.execArgv, ...execArgv],
        },
    );
    await once(childProccess, 'message');
    childProccess.on('error', (e) => console.error(`error in forked process`, e));
    return {
        remoteNodeEnvironment: new RemoteNodeEnvironment(new ForkedProcess(childProccess)),
        process: childProccess,
    };
}

export class RemoteNodeEnvironment implements IDisposable {
    private disposables = new SafeDisposable(RemoteNodeEnvironment.name);
    dispose = this.disposables.dispose;
    isDisposed = this.disposables.isDisposed;
    private messageHandlers = new Set<(message: ICommunicationMessage) => void>();

    constructor(private childEnv: RemoteProcess) {
        this.disposables.add('child environment', () => {
            for (const handler of this.messageHandlers) {
                this.childEnv.off('message', handler);
            }
            this.messageHandlers.clear();
            this.childEnv?.terminate?.();
        });
    }

    public async getRemotePort(): Promise<number> {
        return new Promise((resolve) => {
            // missing cleanup
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
}
