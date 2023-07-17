import cors from 'cors';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

export interface RouteMiddleware {
    path: string;
    handlers: express.RequestHandler | express.RequestHandler[];
}

export interface LaunchOptions {
    httpServerPort?: number;
    socketServerOptions?: Partial<io.ServerOptions>;
    middlewares?: Array<RouteMiddleware>;
}

export async function launchServer({
    httpServerPort = 3000,
    socketServerOptions,
    middlewares = [],
}: LaunchOptions = {}) {
    const app = express();
    app.use(cors());

    for (const { path, handlers } of middlewares) {
        app.use(path, handlers);
    }

    app.use('/favicon.ico', noContentHandler);

    const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);
    const socketServer = new io.Server(httpServer, { cors: {}, ...socketServerOptions, transports: ['websocket'] });

    const close = () =>
        new Promise<void>((res, rej) => {
            httpServer.closeAllConnections();
            socketServer.close((e) => (e ? rej(e) : res()));
        });

    return {
        close,
        port,
        app,
        httpServer,
        socketServer,
    };
}