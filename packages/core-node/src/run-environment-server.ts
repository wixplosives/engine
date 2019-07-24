import { COM } from '@wixc3/engine-core';
import { getParentProcess, IEnvironmentPortMessage, isEnvironmentStartStaticMessage } from '@wixc3/engine-scripts';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';
import { WsServerHost } from './ws-node-host';

getParentProcess().then(parentProcess => {
    if (parentProcess) {
        parentProcess.on('message', async message => {
            if (isEnvironmentStartStaticMessage(message)) {
                const { envName, entityPaths, serverConfig } = message;
                const app = express();
                const { httpServer, port } = await safeListeningHttpServer(3000, app);
                const socketServer = io(httpServer).of('/_ws');
                for (const entityPath of entityPaths) {
                    require(entityPath).default([
                        COM.use({
                            config: {
                                host: new WsServerHost(socketServer),
                                id: envName
                            }
                        }),
                        ...serverConfig
                    ]);
                }
                const portMessage: IEnvironmentPortMessage = {
                    id: 'port',
                    port
                };
                parentProcess!.postMessage(portMessage);
            }
        });
    }
});
