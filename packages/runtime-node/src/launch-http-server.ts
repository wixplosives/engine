import express from 'express';
import cors from 'cors';
import { safeListeningHttpServer } from 'create-listening-server';
import io from 'socket.io';
import type { Socket } from 'net';

export const DEFAULT_PORT = 3000;

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

export interface RouteMiddleware {
    path: string;
    handlers: express.RequestHandler | express.RequestHandler[];
}

export interface ILaunchHttpServerOptions {
    staticDirPath?: string;
    httpServerPort?: number;
    socketServerOptions?: Partial<io.ServerOptions>;
    routeMiddlewares?: Array<RouteMiddleware>;
}

export async function launchEngineHttpServer({
    staticDirPath,
    httpServerPort = DEFAULT_PORT,
    socketServerOptions,
    routeMiddlewares = [],
}: ILaunchHttpServerOptions = {}): Promise<{
    close: () => Promise<void>;
    port: number;
    app: express.Express;
    socketServer: io.Server;
}> {
    const app = express();
    for (const { path, handlers } of routeMiddlewares) {
        app.use(path, handlers);
    }
    app.use(cors());
    const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);

    if (staticDirPath) {
        app.use('/', express.static(staticDirPath));
    }

    app.use('/favicon.ico', noContentHandler);

    const openSockets = new Set<Socket>();
    httpServer.on('connection', (socket) => {
        openSockets.add(socket);
        socket.once('close', () => openSockets.delete(socket));
    });
    const socketServer = new io.Server(httpServer, { cors: {}, ...socketServerOptions, transports: ['websocket'] });

    return {
        close: async () => {
            await new Promise<void>((res, rej) => {
                for (const connection of openSockets) {
                    connection.destroy();
                }
                openSockets.clear();
                socketServer.close((e) => (e ? rej(e) : res()));
            });
        },
        port,
        app,
        socketServer,
    };
}
