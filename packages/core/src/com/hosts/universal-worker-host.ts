import type {
    UniversalMessageHandler,
    UniversalWorker,
    UniversalWorkerUserMethods,
} from '@wixc3/isomorphic-worker/types';

import { Target } from '../types';

export class UniversalWorkerHost implements Target {
    private messageHandlersMap = new Map<(event: { data: any }) => void, UniversalMessageHandler>();

    constructor(
        private worker: UniversalWorker | UniversalWorkerUserMethods,
        public name: string,
    ) {}

    public addEventListener(type: 'message', callback: (event: { data: any }) => void): void {
        const handler = (message: any) => callback(message);
        this.messageHandlersMap.set(callback, handler);

        this.worker.addEventListener(type, handler);
    }

    public removeEventListener(type: 'message', callback: (event: { data: any }) => void): void {
        const handler = this.messageHandlersMap.get(callback);
        if (handler) {
            this.worker.removeEventListener(type, handler);
        }
        this.messageHandlersMap.delete(callback);
    }

    public postMessage(data: any): void {
        this.worker.postMessage(data);
    }
}
