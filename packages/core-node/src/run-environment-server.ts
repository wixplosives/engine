import { COM } from '@wixc3/engine-core';
import { IEnvironmentPortMessage, isEnvironmentStartStaticMessage } from '@wixc3/engine-scripts';
import { getParentProcess } from '@wixc3/engine-scripts/src/parent-process';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';
import { WsServerHost } from './ws-node-host';

const parentProcess = getParentProcess();

if (parentProcess) {
    parentProcess.on('message', async message => {
        if (isEnvironmentStartStaticMessage(message)) {
            const { envName, entityPath, serverConfig } = message;
            const app = express();
            const { httpServer, port } = await safeListeningHttpServer(3000, app);
            const socketServer = io(httpServer).of('/_ws');
            require(entityPath).default([
                COM.use({
                    config: {
                        host: new WsServerHost(socketServer),
                        id: envName
                    }
                }),
                ...serverConfig
            ]);
            const portMessage: IEnvironmentPortMessage = {
                id: 'port',
                port
            };
            parentProcess.postMessage(portMessage);
        }
    });
}
