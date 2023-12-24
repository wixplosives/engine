import type io from 'socket.io';
import { BaseHost, Communication, type IDisposable, type Message } from '@wixc3/engine-core';

export class WsHost extends BaseHost {
    constructor(private socket: io.Socket) {
        super();
        this.socket.on('message', (message) => {
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

    constructor(
        private server: io.Server | io.Namespace,
        /**
         * Used to register the proxy connection origin ('main') to the communication
         * this needed because when you use AsyncProxy and call to 'main' from 'processing/node', you have the original env name not the namespaced one.
         */
        private communication?: Communication,
    ) {
        super();
        this.server.on('connection', this.onConnection);
    }

    public postMessage(data: Message) {
        if (data.to !== '*') {
            if (this.socketToEnvId.has(data.to)) {
                const { socket, clientID } = this.socketToEnvId.get(data.to)!;
                data.to = clientID;
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
        const nameSpace = (original: string) => `${socket.id}/${original}`;
        const onMessage = (message: Message): void => {
            // this mapping should not be here because of forwarding of messages
            // maybe change message forwarding to have 'forward destination' and correct 'from'
            // also maybe we can put the init of the map on 'connection' event
            // maybe we can notify from client about the new connected id
            const originId = nameSpace(message.origin);
            const fromId = nameSpace(message.from);
            this.socketToEnvId.set(fromId, { socket, clientID: message.from });
            this.socketToEnvId.set(originId, { socket, clientID: message.origin });
            this.communication?.registerEnv(message.origin, this);
            this.communication?.registerEnv(message.from, this);
            // modify message to be able to forward it
            message.from = fromId;
            message.origin = originId;

            this.emitMessageHandlers(message);
        };
        socket.on('message', onMessage);

        socket.once('disconnect', () => {
            socket.off('message', onMessage);
            for (const [envId, { socket: soc }] of this.socketToEnvId.entries()) {
                if (socket === soc) {
                    this.socketToEnvId.delete(envId);
                    this.emitMessageHandlers({
                        type: 'dispose',
                        from: envId,
                        origin: envId,
                        to: '*',
                        forwardingChain: [],
                    });
                }
            }
        });
    };
}
