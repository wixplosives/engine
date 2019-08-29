import { safeListeningHttpServer } from 'create-listening-server';
import express from 'express';
import http from 'http';
import io, { Server } from 'socket.io';

import { COM, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';

import { getParentProcess } from './parent-process';
import {
    ICommunicationMessage,
    IEnvironment,
    IEnvironmentPortMessage,
    IFeatureDefinition,
    isEnvironmentCloseMessage,
    isEnvironmentPortMessage,
    isEnvironmentStartMessage,
    RemoteProcess,
    ServerEnvironmentOptions
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

    remoteAccess.on('message', async (message: ICommunicationMessage) => {
        if (isEnvironmentPortMessage(message)) {
            remoteAccess.postMessage({ id: 'port', port } as IEnvironmentPortMessage);
        } else if (isEnvironmentStartMessage(message)) {
            environments[message.envName] = await runNodeEnvironment(socketServer, message.data);
            remoteAccess.postMessage({ id: 'start' });
        } else if (isEnvironmentCloseMessage(message) && environments[message.envName]) {
            await environments[message.envName].dispose();
            remoteAccess.postMessage({ id: 'close' });
        }
        return null;
    });
}

export async function runNodeEnvironment(
    socketServer: Server,
    { featureName, childEnvName, features, config = [], name, httpServerPath, type, options }: ServerEnvironmentOptions
) {
    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);

    await runEngineApp({
        featureName,
        featureLoaders: createFeatureLoaders(new Map(features), {
            name,
            childEnvName,
            type
        }),
        config: [
            ...config,
            COM.use({
                config: {
                    host: localDevHost,
                    id: name
                }
            }),
            ...(await getConfig(featureName, httpServerPath))
        ],
        options: new Map(options)
    });

    return {
        dispose: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}

async function getConfig(featureName: string, httpServerPath: string): Promise<Array<[string, object]>> {
    return new Promise((resolve, reject) => {
        http.get(`${httpServerPath}config?feature=${featureName}`, response => {
            let data = '';
            response.on('data', chunk => {
                data += chunk;
            });
            response.on('end', () => {
                resolve(JSON.parse(data));
            });
            response.on('error', err => {
                reject(err);
            });
        });
    });
}

function createFeatureLoaders(
    features: Map<string, IFeatureDefinition>,
    { name: envName, childEnvName }: IEnvironment
) {
    const featureLoaders: Record<string, IFeatureLoader> = {};
    for (const {
        scopedName,
        filePath,
        dependencies,
        envFilePaths,
        contextFilePaths,
        resolvedContexts
    } of features.values()) {
        featureLoaders[scopedName] = {
            load: async currentContext => {
                if (childEnvName && currentContext[envName] === childEnvName) {
                    const contextFilePath = contextFilePaths[`${envName}/${childEnvName}`];
                    if (contextFilePath) {
                        await import(contextFilePath);
                    }
                }
                const envFilePath = envFilePaths[envName];
                if (envFilePath) {
                    await import(envFilePath);
                }
                return (await import(filePath)).default;
            },
            depFeatures: dependencies,
            resolvedContexts
        };
    }
    return featureLoaders;
}
