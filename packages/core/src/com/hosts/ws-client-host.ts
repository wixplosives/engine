import { io, Socket, SocketOptions } from 'socket.io-client';
import type { Message } from '../message-types';
import { BaseHost } from './base-host';
import { deferred, EventEmitter } from '../../helpers';

export class WsClientHost extends BaseHost {
    public connected: Promise<void>;
    private socketClient: Socket;
    public subscribers = new EventEmitter<{ disconnect: void; reconnect: void }>();

    constructor(url: string, options?: Partial<SocketOptions>) {
        super();

        const { promise, resolve } = deferred();
        this.connected = promise;

        this.socketClient = io(url, { transports: ['websocket'], forceNew: true, ...options });

        this.socketClient.on('connect', () => {
            this.socketClient.on('message', (data: unknown) => {
                this.emitMessageHandlers(data as Message);
            });
            resolve();
        });

        this.socketClient.on('disconnect', () => {
            this.subscribers.emit('disconnect', undefined);
            this.socketClient.close();
        });

        this.socketClient.on('reconnect', () => {
            this.subscribers.emit('reconnect', undefined);
        });

        this.socketClient.connect();
    }

    public postMessage(data: any) {
        this.socketClient.emit('message', data);
    }

    public dispose() {
        this.subscribers.clear();
        this.socketClient.close();
    }
}
