import { COM } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';
import { Server } from 'socket.io';
import { parentPort } from 'worker_threads';
import { EnvironmentEntryBuilder } from './engine-utils/environment-entry-builder';
import { IEnvironmentMessage, isEnvironmentStartMessage, ServerEnvironmentOptions } from './types';

if (parentPort) {
    createWorkerProtocol();
}

async function createWorkerProtocol() {
    const app = express();
    const environments: Record<string, { dispose: () => Promise<void> }> = {};
    const { httpServer, port } = await safeListeningHttpServer(3000, app);
    parentPort!.postMessage({ id: 'port', port });
    const socketServer = io(httpServer);

    parentPort!.on('message', async (message: IEnvironmentMessage) => {
        if (isEnvironmentStartMessage(message)) {
            environments[message.envName] = initEnvironmentServer(socketServer, message.data);
        } else {
            if (environments[message.envName]) {
                await environments[message.envName].dispose();
                parentPort!.postMessage({ id: 'close' });
            }
        }
    });
}

/**
 * Use to init socket server that share the environment state between all connections
 */
export function initEnvironmentServer(
    socketServer: Server,
    { environments, featureMapping, featureName, configName, projectPath }: ServerEnvironmentOptions
) {
    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);
    const nodeEnvironments = environments.filter(({ target }) => target === 'node');
    for (const { name, envFiles, contextFiles } of nodeEnvironments) {
        const featureMap = featureName || Object.keys(featureMapping.mapping)[0];
        const configMap = configName || Object.keys(featureMapping.mapping[featureMap].configurations)[0];
        const contextMappings = featureMapping.mapping[featureMap].context;
        const { engine, runningFeature } = new EnvironmentEntryBuilder().runEntry(
            featureMap,
            configMap,
            { envFiles, featureMapping, contextFiles },
            [
                COM.use({
                    config: {
                        host: localDevHost,
                        id: name,
                        contextMappings
                    }
                }),
                [
                    'project',
                    {
                        fsProjectDirectory: {
                            projectPath
                        }
                    }
                ]
            ]
        );
        disposeHandlers.add(() => engine.dispose(runningFeature));
    }

    disposeHandlers.add(localDevHost.dispose.bind(localDevHost));

    return {
        dispose: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}
