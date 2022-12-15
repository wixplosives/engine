import type { EventEmitter } from '@wixc3/patterns';
import type { Message } from '../message-types';
import { BaseHost } from './base-host';

export class EventEmitterHost extends BaseHost {
    constructor(private host: EventEmitter<{ message: Message }>) {
        super();

        this.host.on('message', (data) => this.emitMessageHandlers(data));
    }

    public postMessage(message: Message) {
        this.emitMessageHandlers(message);
    }
}
