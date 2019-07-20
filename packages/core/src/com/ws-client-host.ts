import { deferred } from 'promise-assist';
import io from 'socket.io-client';
import { BaseHost } from './base-host';

export class WsClientHost extends BaseHost {
    public connected: Promise<void>;
    private socketClient: SocketIOClient.Socket;

    constructor(url: string) {
        super();

        const { promise, resolve } = deferred();
        this.connected = promise;

        this.socketClient = io.connect(url);

        this.socketClient.on('connect', () => {
            resolve();
            this.socketClient.on('message', (data: any) => {
                this.emitMessageHandlers(data);
            });
        });

        this.socketClient.on('disconnect', () => {
            this.socketClient.close();
        });
    }

    public postMessage(data: any) {
        this.socketClient.emit('message', data);
    }
}
