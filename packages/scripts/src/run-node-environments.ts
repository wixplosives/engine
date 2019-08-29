import { Server } from 'socket.io';

import { COM, flattenTree, IFeatureLoader, runEngineApp, TopLevelConfig } from '@wixc3/engine-core';
import { WsServerHost } from '@wixc3/engine-core-node';

import { IEnvironment, IFeatureDefinition } from './analyze-feature';

export interface IRunNodeEnvironmentsOptions {
    socketServer: Server;
    features: Map<string, IFeatureDefinition>;
    featureName: string;
    options?: Map<string, string>;
    config?: TopLevelConfig;
}

export async function runNodeEnvironments({
    featureName,
    socketServer,
    features,
    options = new Map<string, string>(),
    config = []
}: IRunNodeEnvironmentsOptions) {
    const nodeEnvs = nodeEnvsForFeature(features, featureName);

    const disposeHandlers: Set<() => unknown> = new Set();
    const socketServerNamespace = socketServer.of('/_ws');
    const localDevHost = new WsServerHost(socketServerNamespace);
    disposeHandlers.add(() => localDevHost.dispose());

    for (const env of nodeEnvs) {
        options = new Map([...Array.from(getProcessOptions().entries()), ...Array.from(options.entries())]);
        const { dispose } = await runEngineApp({
            featureName,
            featureLoaders: createFeatureLoaders(features, env),
            config: [
                ...config,
                COM.use({
                    config: {
                        host: localDevHost,
                        id: env.name
                    }
                })
            ],
            options
        });

        disposeHandlers.add(() => dispose());
    }

    return {
        environments: nodeEnvs,
        dispose: async () => {
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

function nodeEnvsForFeature(features: Map<string, IFeatureDefinition>, featureName: string) {
    const featureDefinition = features.get(featureName);
    if (!featureDefinition) {
        const featureNames = Array.from(features.keys());
        throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
    }
    const { resolvedContexts } = featureDefinition;

    const nodeEnvs = new Set<IEnvironment>();
    const deepDefsForFeature = flattenTree(featureDefinition, f => f.dependencies.map(fName => features.get(fName)!));
    for (const { exportedEnvs } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (
                exportedEnv.type === 'node' &&
                (!exportedEnv.childEnvName || resolvedContexts[exportedEnv.name] === exportedEnv.childEnvName)
            ) {
                nodeEnvs.add(exportedEnv);
            }
        }
    }
    return nodeEnvs;
}

function getProcessOptions() {
    const args = process.argv.slice(3);
    const argumentQueue: string[] = [];
    const options = new Map<string, string>();
    while (args.length) {
        const currentArgument = args.shift()!;
        if (currentArgument.startsWith('--')) {
            if (argumentQueue.length) {
                options.set(argumentQueue.shift()!, argumentQueue.join(' '));
                argumentQueue.length = 0;
            }
            argumentQueue.push(currentArgument.slice(2).replace(/[-]\S/g, match => match.slice(1).toUpperCase()));
        } else if (argumentQueue.length) {
            argumentQueue.push(currentArgument);
        } else if (args.length && !args[0].startsWith('--')) {
            args.shift();
        }
    }
    if (argumentQueue.length) {
        options.set(argumentQueue.shift()!, argumentQueue.join(' '));
    }
    return options;
}
