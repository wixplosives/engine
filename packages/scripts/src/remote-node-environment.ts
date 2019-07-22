import { join } from 'path';
import { Worker } from 'worker_threads';
import { ICommunicationMessage, IEnvironmentMessageID, isPortMessage } from './types';

export class RemoteNodeEnvironment {
    private worker: Worker | undefined;

    public async start() {
        this.worker = new Worker(join(__dirname, 'run-node-server'));
        return this.getWorkerPort();
    }

    public postMessage<T extends ICommunicationMessage>(message: T) {
        if (!this.worker) {
            throw new Error('worker is not started');
        }
        this.worker.postMessage(message);
    }

    public waitForMessage(messageId: IEnvironmentMessageID): Promise<ICommunicationMessage> {
        if (!this.worker) {
            throw new Error('worker is not started');
        }
        return new Promise(resolve => {
            this.worker!.on('message', (message: ICommunicationMessage) => {
                if (message.id === messageId) {
                    resolve(message);
                }
            });
        });
    }

    public dispose() {
        if (this.worker) {
            this.worker.terminate();
        }
    }

    private async getWorkerPort(): Promise<number> {
        if (!this.worker) {
            throw new Error('worker is not started');
        }
        return await new Promise(resolve => {
            this.worker!.on('message', (message: ICommunicationMessage) => {
                if (isPortMessage(message)) {
                    resolve(message.port);
                }
            });
        });
    }
}
