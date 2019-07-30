import { COM, EnvironmentLiveServer, IComConfig } from '@wixc3/engine-core';
import { IEnvironmentStartStaticMessage } from '@wixc3/engine-scripts/src';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import { join } from 'path';
import { RemoteNodeEnvironment } from './remote-node-environment';

export interface EnvironmentDescription {
    env: EnvironmentLiveServer<string>;
    entryPath: string;
}

export async function initEngineServer(
    preferredPort: number,
    clientEntry: string,
    pathToEditorDist: string,
    clientConfig: unknown[] = [],
    serverConfig: Array<Partial<IComConfig>> = [],
    serverEnvironments: EnvironmentDescription[] = []
) {
    const app = express();
    app.use(express.static(pathToEditorDist));

    app.get('/', (_request, response) => {
        response.sendFile(clientEntry);
    });

    const { port } = await safeListeningHttpServer(preferredPort, app);

    app.use('/favicon.ico', (_req, res) => {
        res.status(204); // No Content
        res.end();
    });

    app.get('/health/is_alive', (_request, response) => {
        response.status(200).end();
    });

    const topology: Record<string, string> = {};
    for (const {
        entryPath,
        env: { env: name, getLocalTopology }
    } of serverEnvironments) {
        const remoteEnvironment = new RemoteNodeEnvironment(join(__dirname, 'init-environment-server'));
        const environmentPort = await remoteEnvironment.start();
        Object.assign(topology, getLocalTopology(environmentPort));
        const startStaticServerMessage: IEnvironmentStartStaticMessage = {
            id: 'start-static',
            envName: name,
            entityPath: entryPath,
            serverConfig
        };
        remoteEnvironment.postMessage(startStaticServerMessage);
    }
    clientConfig.push(
        COM.use({
            config: {
                topology
            }
        })
    );

    app.get('/server-config.js', (_req, res) => {
        res.json(clientConfig);
        res.end();
    });

    if (process.send) {
        process.send({ port });
    }

    return port;
}
