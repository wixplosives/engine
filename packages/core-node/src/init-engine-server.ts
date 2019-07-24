import { COM, EnvironmentLiveServer } from '@wixc3/engine-core';
import { RemoteNodeEnvironment } from '@wixc3/engine-scripts';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import { join } from 'path';

export async function initEngineServer(
    preferredPort: number,
    clientEntry: string,
    pathToEditorDist: string,
    serverEntries?: string[],
    clientConfig: unknown[] = [],
    serverConfig: unknown[] = [],
    serverEnvironment?: EnvironmentLiveServer<string>
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

    if (serverEnvironment && serverEntries) {
        const remoteEnvironment = new RemoteNodeEnvironment(join(__dirname, 'run-environment-server.js'));
        const environmentPort = await remoteEnvironment.start();
        remoteEnvironment.postMessage({
            id: 'start-static',
            envName: serverEnvironment.env,
            entityPaths: serverEntries,
            serverConfig
        });
        clientConfig.push(
            COM.use({
                config: {
                    topology: serverEnvironment.getLocalTopology(environmentPort)
                }
            })
        );
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
