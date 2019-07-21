import { COM, ConfigLoader, IFeatureLoader, runEngineApp } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { Server } from 'socket.io';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';

export interface IRunNodeEnvironmentsOptions {
    socketServer: Server;
    features: Map<string, IFeatureDefinition>;
    configurations: Map<string, string>;
    environments: IEnvironment[];
    featureName?: string;
    configName?: string;
    projectPath: string;
}

export async function runNodeEnvironments({
    socketServer,
    features,
    configurations,
    environments,
    featureName,
    configName,
    projectPath
}: IRunNodeEnvironmentsOptions) {
    const configLoaders: Record<string, ConfigLoader> = {};
    for (const [configLoaderName, configFilePath] of configurations) {
        configLoaders[configLoaderName] = async () => (await import(configFilePath)).default;
    }

    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);
    for (const { name, childEnvName } of environments) {
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
            configName,
            featureName,
            featureLoaders,
            configLoaders,
            overrideConfig: [
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
            ]
        });

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
