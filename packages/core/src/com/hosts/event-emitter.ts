import type { EventEmitter } from '@wixc3/patterns';
import type { Message } from '../message-types.js';
import { BaseHost } from './base-host.js';

export class EventEmitterHost extends BaseHost {
    constructor(private host: EventEmitter<{ message: Message }>) {
        super();

        this.host.on('message', (data) => this.emitMessageHandlers(data));
    }

    public postMessage(message: Message) {
        this.emitMessageHandlers(message);
    }
}
