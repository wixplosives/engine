import { COM, flattenTree, IFeatureLoader, runEngineApp, TopLevelConfig } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { Server } from 'socket.io';
import { IEnvironment, IFeatureDefinition } from './analyze-feature';

export interface IRunNodeEnvironmentsOptions {
    socketServer: Server;
    features: Map<string, IFeatureDefinition>;
    featureName: string;
    config?: TopLevelConfig;
}

export async function runNodeEnvironments({
    featureName,
    socketServer,
    features,
    config = []
}: IRunNodeEnvironmentsOptions) {
    const featureDefinition = features.get(featureName);
    if (!featureDefinition) {
        const featureNames = Array.from(features.keys());
        throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
    }
    const nodeEnvs = new Set<IEnvironment>();
    const deepDefsForFeature = flattenTree(featureDefinition, f => f.dependencies.map(fName => features.get(fName)!));
    for (const { exportedEnvs } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (exportedEnv.type === 'node') {
                nodeEnvs.add(exportedEnv);
            }
        }
    }

    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);
    for (const { name, childEnvName } of nodeEnvs) {
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
            featureName,
            featureLoaders,
            config: [
                ...config,
                COM.use({
                    config: {
                        host: localDevHost,
                        id: name
                    }
                })
            ]
        });

        disposeHandlers.add(() => engine.dispose(runningFeature));
    }

    disposeHandlers.add(localDevHost.dispose.bind(localDevHost));

    return {
        environments: nodeEnvs,
        dispose: async () => {
            for (const disposeHandler of disposeHandlers) {
                await disposeHandler();
            }
        }
    };
}
