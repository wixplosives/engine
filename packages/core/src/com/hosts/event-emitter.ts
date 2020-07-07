/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseHost } from './base-host';
import type { EventEmitter } from 'events';

export class EventEmitterHost extends BaseHost {
    constructor(private host: EventEmitter) {
        super();

        this.host.on('message', (data) => this.emitMessageHandlers(data));
    }

    public postMessage(message: any) {
        this.emitMessageHandlers(message);
    }
}
