import { BaseHost } from '@wixc3/engine-core';
import { IDisposable } from '@wixc3/engine-core';
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

/**
 * TODO: handle disconnect
 */
export class WsServerHost extends BaseHost implements IDisposable {
    private socketToEnvId = new Map<string, { socket: io.Socket; clientID: string }>();
    private disposed = false;

    constructor(private server: io.Namespace) {
        super();
        this.server.on('connection', this.onConnection);
    }

    public postMessage(data: any) {
        if (data.to !== '*') {
            if (this.socketToEnvId.has(data.to)) {
                const { socket, clientID } = this.socketToEnvId.get(data.to)!;
                data.to = clientID;
                if (data.type === 'event') {
                    data.handlerId = data.handlerId.slice(0, data.handlerId.length - socket.id.length);
                }
                socket.emit('message', data);
            } else {
                this.server.emit('message', data);
            }
        } else {
            this.server.emit('message', data);
        }
    }

    public dispose() {
        this.handlers.clear();
        this.server.off('connection', this.onConnection);
        this.disposed = true;
    }

    public isDisposed() {
        return this.disposed;
    }

    private onConnection = (socket: io.Socket): void => {
        const onMessage: (...args: any[]) => void = message => {
            // this mapping should not be here because of forwarding of messages
            // maybe change message forwarding to have 'forward destination' and correct 'from'
            // also maybe we can put the init of the map on 'connection' event
            // maybe we can notify from client about the new connected id
            if (message.type === 'listen') {
                message.data.handlerId += socket.id;
            }
            this.socketToEnvId.set(socket.id, { socket, clientID: message.from });
            if (message.origin !== message.from) {
                console.warn(`Warning: ${JSON.stringify(message)} has different origin and sender.
                This means that the message was forwarded not properly`);
            }
            message.origin = socket.id;
            message.from = socket.id;
            this.emitMessageHandlers(message);
        };
        socket.on('message', onMessage);
        socket.once('disconnect', () => socket.off('message', onMessage));
    };
}
