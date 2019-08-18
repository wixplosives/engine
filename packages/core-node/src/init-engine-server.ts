import { COM, Environment } from '@wixc3/engine-core';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import { Server } from 'http';
import io from 'socket.io';
import { WsServerHost } from './ws-node-host';

export async function initEngineServer(
    preferredPort: number,
    clientEntry: string,
    pathToEditorDist: string,
    serverEntries?: string[],
    clientConfig: unknown[] = [],
    serverConfig: unknown[] = [],
    serverEnvironment?: Environment<string, 'node'>
) {
    const app = express();
    app.use(express.static(pathToEditorDist));

    app.get('/', (_request, response) => {
        response.sendFile(clientEntry);
    });

    const { httpServer, port } = await safeListeningHttpServer(preferredPort, app);

    app.use('/favicon.ico', (_req, res) => {
        res.status(204); // No Content
        res.end();
    });

    app.get('/health/is_alive', (_request, response) => {
        response.status(200).end();
    });

    if (serverEnvironment && serverEntries) {
        runNodeEnvironment(serverEntries, httpServer, serverEnvironment, serverConfig);
        // clientConfig.push(
        //     COM.use({
        //         config: {
        //             topology: serverEnvironment.getLocalTopology(port)
        //         }
        //     })
        // );
    }

    app.get('/server-config.js', (_req, res) => {
        res.json(clientConfig);
        res.end();
    });

    if (process.send) {
        process.send({ port });
    }

    return port;
}

function runNodeEnvironment(
    nodeEntityPaths: string[],
    server: Server,
    serverEnvironment: Environment,
    serverConfig: unknown[]
) {
    const socketServer = io(server).of('/_ws');
    for (const nodeEntityPath of nodeEntityPaths) {
        require(nodeEntityPath).default([
            COM.use({
                config: {
                    host: new WsServerHost(socketServer),
                    id: serverEnvironment.env
                }
            }),
            ...serverConfig
        ]);
    }
}
