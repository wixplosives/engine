import { Server } from 'socket.io';

import { COM, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';
import { WsServerHost, IPCHost } from '@wixc3/engine-core-node';

import { IEnvironment, IFeatureDefinition, StartEnvironmentOptions } from './types';
import { createDisposables } from '@wixc3/engine-test-kit/src';

export async function runServerEnvironment(socketServer: Server, startEnvironmentOptions: StartEnvironmentOptions) {
    const disposeHandlers = createDisposables();
    const socketServerNamespace = socketServer.of(name);
    const host = new WsServerHost(socketServerNamespace);
    disposeHandlers.add(() => host.dispose());

    const { close } = await runEnvironment({ ...startEnvironmentOptions, host });
    disposeHandlers.add(() => close());
    return {
        close: disposeHandlers.dispose
    };
}

export async function runIPCEnvironment(optinos: StartEnvironmentOptions) {
    const disposeHandlers = new Set<() => unknown>();
    const host = new IPCHost(process);
    disposeHandlers.add(() => host.dispose());
    const { close } = await runEnvironment({
        ...optinos,
        host
    });
    disposeHandlers.add(() => close());
    return {
        close: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}

export async function runEnvironment({
    featureName,
    childEnvName,
    features,
    config = [],
    name,
    type,
    options,
    host
}: StartEnvironmentOptions) {
    if (!host) {
        throw new Error('cannot start environment without a root host');
    }
    const disposeHandlers = new Set<() => unknown>();

    const runningEngine = await runEngineApp({
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
                    host,
                    id: name
                }
            })
        ],
        options: new Map(options),
        envName: name
    });
    disposeHandlers.add(() => runningEngine.dispose());

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
