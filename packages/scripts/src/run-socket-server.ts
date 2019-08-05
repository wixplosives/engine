import { COM, IFeatureLoader, runEngineApp, TopLevelConfig } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import io from 'socket.io';
import { Server } from 'socket.io';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';
import { getParentProcess } from './parent-process';
import {
    ICommunicationMessage,
    IEnvironmentPortMessage,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess
} from './types';

const parentProcess = getParentProcess();
if (parentProcess) {
    // tslint:disable-next-line: no-floating-promises
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
            environments[message.envName] = await runNodeEnvironment(socketServer, message.data);
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

export type IRunNodeEnvironmentsOptions = IEnvironment & {
    featureName: string;
    config?: TopLevelConfig;
    features: Record<string, IFeatureDefinition>;
    httpServerPath: string;
    projectPath?: string;
};

export async function runNodeEnvironment(
    socketServer: Server,
    {
        featureName,
        childEnvName,
        features,
        config = [],
        name,
        httpServerPath,
        projectPath = process.cwd()
    }: IRunNodeEnvironmentsOptions
) {
    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);

    const featureLoaders: Record<string, IFeatureLoader> = {};
    for (const {
        scopedName,
        filePath,
        dependencies,
        envFilePaths,
        contextFilePaths,
        resolvedContexts
    } of Object.values(features)) {
        featureLoaders[scopedName] = {
            load: async () => {
                if (childEnvName) {
                    const contextFilePath = contextFilePaths[`${name}/${childEnvName}`];
                    if (contextFilePath) {
                        await import(contextFilePath);
                    }
                }
                const envFilePath = envFilePaths[name];
                if (envFilePath) {
                    await import(envFilePath);
                }
                return (await import(filePath)).default;
            },
            depFeatures: dependencies,
            resolvedContexts
        };
    }

    const { engine, runningFeature } = await runEngineApp({
        featureName,
        featureLoaders,
        config: [
            ...config,
            COM.use({
                config: {
                    host: localDevHost,
                    id: name
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
        ],
        httpServerPath
    });

    disposeHandlers.add(() => engine.dispose(runningFeature));

    return {
        dispose: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}
