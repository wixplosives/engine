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

interface ILaunchHttpServerOptions {
    staticDirPath: string;
    httpServerPort?: number;
}

export async function launchHttpServer({ staticDirPath, httpServerPort = DEFAULT_PORT, }: ILaunchHttpServerOptions) {
    const app = express();
    app.use(cors());
    const openSockets = new Set<Socket>();
    const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);
    httpServer.on('connection', (socket) => {
        openSockets.add(socket);
        socket.once('close', () => openSockets.delete(socket));
    });

    app.use('/', express.static(staticDirPath));

    app.use('/favicon.ico', noContentHandler);

    const socketServer = io(httpServer);

    return {
        close: async () => {
            await new Promise((res) => {
                for (const connection of openSockets) {
                    connection.destroy();
                }
                openSockets.clear();
                socketServer.close(res);
            });
        },
        port,
        app,
        socketServer,
    };
}
