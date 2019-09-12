import { Server } from 'socket.io';

import { COM, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';

import { IEnvironment, IFeatureDefinition, ServerEnvironmentOptions } from './types';

export async function runNodeEnvironment(
    socketServer: Server,
    { featureName, childEnvName, features, config = [], name, type, options }: ServerEnvironmentOptions
) {
    const disposeHandlers = new Set<() => unknown>();
    const socketServerNamespace = socketServer.of(name);
    const localDevHost = new WsServerHost(socketServerNamespace);
    disposeHandlers.add(() => localDevHost.dispose());

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
            })
        ],
        options: new Map(options),
        envName: name
    });

    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
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
