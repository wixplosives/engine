import { io, Socket, SocketOptions } from 'socket.io-client';
import type { Message } from '../message-types';
import { BaseHost } from './base-host';
import { EventEmitter } from '@wixc3/patterns';
import { deferred } from 'promise-assist';

export class WsClientHost extends BaseHost {
    public connected: Promise<void>;
    private socketClient: Socket;
    public subscribers = new EventEmitter<{ disconnect: void; reconnect: void }>();

    constructor(url: string, options?: Partial<SocketOptions>) {
        super();

        const { path, ...query } = Object.fromEntries(new URL(url).searchParams);

        const { promise, resolve } = deferred();
        this.connected = promise;

        this.socketClient = io(url, {
            transports: ['websocket'],
            forceNew: true,
            withCredentials: true, // Pass Cookie to socket io connection
            path,
            query,
            ...options,
        });

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
