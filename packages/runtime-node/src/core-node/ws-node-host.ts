import type io from 'socket.io';
import { BaseHost, type IDisposable, type Message } from '@wixc3/engine-core';

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

    constructor(private server: io.Server | io.Namespace) {
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
            message.from = fromId;
            message.origin = originId;
            this.emitMessageHandlers(message);
        };
        socket.on('message', onMessage);

        socket.once('disconnect', () => {
            socket.off('message', onMessage);
            const disconnectedEnvs = [...this.socketToEnvId.entries()].reduce((acc, [envId, { socket: soc }]) => {
                if (socket === soc) {
                    acc.add(envId);
                }
                return acc;
            }, new Set<string>());
            for (const env of disconnectedEnvs) {
                this.socketToEnvId.delete(env);
                this.emitMessageHandlers({
                    type: 'dispose',
                    from: env,
                    origin: env,
                    to: '*',
                    forwardingChain: [],
                });
            }
        });
    };
}
