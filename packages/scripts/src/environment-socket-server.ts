import { COM } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';
import { Server } from 'socket.io';
import { EnvironmentEntryBuilder } from './engine-utils/environment-entry-builder';
import { EngineEnvironmentEntry, FeatureMapping } from './types';

/**
 * Use to init socket server that share the environment state between all connections
 */
export function initEnvironmentServer(
    socketServer: Server,
    environments: EngineEnvironmentEntry[],
    featureMapping: FeatureMapping,
    featureName: string | undefined,
    configName: string | undefined,
    projectPath: string
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
