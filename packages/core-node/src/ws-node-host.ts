import { BaseHost } from '@wixc3/engine-core';
import io from 'socket.io';

export class WsHost extends BaseHost {
    constructor(private socket: io.Socket) {
        super();
        this.socket.on('message', message => {
            this.emitMessageHandlers(message);
        });
    }
    public postMessage(data: any) {
        this.socket.emit('message', data);
    }
}

export class WsServerSocketHost extends BaseHost {
    constructor(private socket: io.Socket) {
        super();
        this.socket.on('message', this.onMessage);
        this.socket.on('disconnect', this.dispose);
    }

    public onMessage = (message: any) => {
        this.emitMessageHandlers(message);
    };

    public postMessage(data: any) {
        this.socket.emit('message', data);
    }
    public dispose = () => {
        super.dispose();
        this.socket.off('message', this.onMessage);
        this.socket.disconnect(true);
    };
}
