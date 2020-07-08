import express from 'express';
import cors from 'cors';
import { Socket } from 'net';
import { safeListeningHttpServer } from 'create-listening-server';
import io from 'socket.io';
import { DEFAULT_PORT } from './application';

const noContentHandler: express.RequestHandler = (_req, res) => {
    res.status(204); // No Content
    res.end();
};

export async function launchHttpServer({
   outputPath,
   httpServerPort = DEFAULT_PORT,
}: {
    outputPath: string,
    httpServerPort?: number,
}) {
    const app = express();
    app.use(cors());
    const openSockets = new Set<Socket>();
    const { port, httpServer } = await safeListeningHttpServer(httpServerPort, app);
    httpServer.on('connection', (socket) => {
        openSockets.add(socket);
        socket.once('close', () => openSockets.delete(socket));
    });

    app.use('/', express.static(outputPath));

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
