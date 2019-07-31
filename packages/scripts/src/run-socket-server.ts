import { COM } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';
import { Server } from 'socket.io';
import { runEntry } from './engine-utils/run-entry';
import { getParentProcess } from './parent-process';
import {
    ICommunicationMessage,
    IEnvironmentPortMessage,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess,
    ServerEnvironmentOptions
} from './types';

const parentProcess = getParentProcess();
if (parentProcess) {
    createWorkerProtocol(parentProcess);
}

export async function createWorkerProtocol(remoteAccess: RemoteProcess) {
    const app = express();
    const environments: Record<string, { dispose: () => Promise<void> }> = {};
    const { httpServer, port } = await safeListeningHttpServer(3000, app);
    const socketServer = io(httpServer);

    remoteAccess!.on('message', async (message: ICommunicationMessage) => {
        if (isEnvironmentPortMessage(message)) {
            remoteAccess!.postMessage({ id: 'port', port } as IEnvironmentPortMessage);
        } else if (isEnvironmentStartMessage(message)) {
            environments[message.envName] = await initEnvironmentServer(socketServer, message.data);
            remoteAccess!.postMessage({ id: 'start' });
        } else if (isEnvironmentCloseMessage(message) && environments[message.envName]) {
            await environments[message.envName].dispose();
            remoteAccess!.postMessage({ id: 'close' });
        }
        return null;
    });
}

/**
 * Use to init socket server that share the environment state between all connections
 */
export async function initEnvironmentServer(
    socketServer: Server,
    { environment, featureMapping, featureName, configName, projectPath, serverPort }: ServerEnvironmentOptions
) {
    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);
    const { name, envFiles, contextFiles } = environment;
    const featureMap = featureName || Object.keys(featureMapping.mapping)[0];
    const configMap = configName || Object.keys(featureMapping.mapping[featureMap].configurations)[0];
    const contextMappings = featureMapping.mapping[featureMap].context;
    const { engine, runningFeature } = await runEntry(
        featureMap,
        configMap,
        { envFiles: new Set(envFiles), featureMapping, contextFiles: new Set(contextFiles) },
        serverPort,
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
    disposeHandlers.add(localDevHost.dispose.bind(localDevHost));

    return {
        dispose: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}
