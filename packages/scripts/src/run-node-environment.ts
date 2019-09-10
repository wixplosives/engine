import { Server } from 'socket.io';

import { COM, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';
import { WsServerSocketHost } from '@wixc3/engine-core-node';

import { IEnvironment, IFeatureDefinition, ServerEnvironmentOptions } from './types';

export function runNodeEnvironment(
    socketServer: Server,
    { featureName, childEnvName, features, config = [], name, type, options }: ServerEnvironmentOptions
) {
    const socketServerNamespace = socketServer.of(name);
    const disposeHandlers: Array<() => unknown> = [];
    socketServerNamespace.on('connection', async socket => {
        const { dispose } = await runEngineApp({
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
                        host: new WsServerSocketHost(socket),
                        id: name
                    }
                })
            ],
            options: new Map(options),
            envName: name
        });
        disposeHandlers.push(() => dispose());
    });
    return {
        async close() {
            socketServerNamespace.removeAllListeners();
            for (const handler of disposeHandlers) {
                await handler();
            }
        }
    };
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
