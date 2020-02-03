import { delimiter } from 'path';
import io from 'socket.io';

import { COM, flattenTree, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';

import { startRemoteNodeEnvironment } from './remote-node-environment';
import { runNodeEnvironment } from './run-node-environment';
import {
    IConfigDefinition,
    IEnvironment,
    IEnvironmentMessage,
    IEnvironmentStartMessage,
    IFeatureDefinition,
    isEnvironmentStartMessage,
    ServerEnvironmentOptions
} from './types';
import { OverrideConfig } from './config-middleware';

export interface IRuntimeEnvironment {
    topology: Record<string, string>;
    close: () => Promise<void>;
}

export interface RunEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
}

const cliEntry = require.resolve('../cli');

export interface INodeEnvironmentsManagerOptions {
    features: Map<string, IFeatureDefinition>;
    configurations?: SetMultiMap<string, IConfigDefinition | TopLevelConfig>;
    defaultRuntimeOptions?: Record<string, string | boolean>;
    port: number;
    inspect?: boolean;
    config: TopLevelConfig;
}
export type NodeEnvironmentId = {
    featureName: string;
    configName?: string;
};

export class NodeEnvironmentsManager {
    private runningEnvironments = new Map<string, IRuntimeEnvironment>();

    constructor(private socketServer: io.Server, private options: INodeEnvironmentsManagerOptions) {}

    public async runServerEnvironments({
        featureName,
        configName,
        runtimeOptions = {},
        overrideConfigsMap = new Map()
    }: RunEnvironmentOptions & { overrideConfigsMap?: Map<string, OverrideConfig> }) {
        const featureId = `${featureName}${delimiter}${configName}`;

        if (configName) {
            const currentOverrideConfig = overrideConfigsMap.get(configName);
            if (currentOverrideConfig) {
                const { config, configName: originalConfigName } = currentOverrideConfig;
                configName = originalConfigName;
                this.options.config.concat(config);
            }
        }

        const topology: Record<string, string> = {};
        const disposables: Array<() => unknown> = [];
        const { defaultRuntimeOptions } = this.options;
        for (const nodeEnv of this.getNodeEnvironments(featureName)) {
            const { close, port } = await this.launchEnvironment(
                nodeEnv,
                featureName,
                [
                    COM.use({ config: { topology: this.runningEnvironments.get(featureId)?.topology } }),
                    ...(await this.getConfig(configName)),
                    ...this.options.config
                ],
                { ...defaultRuntimeOptions, ...runtimeOptions }
            );
            disposables.push(() => close());
            topology[nodeEnv.name] = `http://localhost:${port}/${nodeEnv.name}`;
        }

        const runningEnvironment: IRuntimeEnvironment = {
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            },
            topology
        };

        this.runningEnvironments.set(featureId, runningEnvironment);
    }

    public async closeEnvironment({ featureName, configName }: RunEnvironmentOptions) {
        const featureId = `${featureName}${delimiter}${configName}`;

        const runningEnvironment = this.runningEnvironments.get(featureId);

        if (!runningEnvironment) {
            throw new Error(`there are no node environments running for ${featureName} and config ${configName}`);
        }
        this.runningEnvironments.delete(featureId);
        await runningEnvironment.close();
    }

    public getFeaturesWithRunningEnvironments() {
        return Array.from(this.runningEnvironments.keys());
    }

    public getTopology(featureName: string, configName?: string) {
        const featureId = `${featureName}${delimiter}${configName}`;
        return this.runningEnvironments.get(featureId)?.topology;
    }

    public async closeAll() {
        for (const runningEnvironment of this.runningEnvironments.values()) {
            await runningEnvironment.close();
        }
        this.runningEnvironments.clear();
    }

    private async launchEnvironment(
        nodeEnv: IEnvironment,
        featureName: string,
        config: Array<[string, object]>,
        options: Record<string, string | boolean>,
        remote?: boolean
    ) {
        const { features, port, inspect } = this.options;
        const serverEnvironmentOptions: ServerEnvironmentOptions = {
            ...nodeEnv,
            config,
            featureName,
            features: Array.from(features.entries()),
            options: Object.entries(options),
            inspect: !!inspect
        };

        if (remote || inspect) {
            return this.startRemoteNodeEnvironment(serverEnvironmentOptions);
        }

        const { close } = await runNodeEnvironment(this.socketServer, serverEnvironmentOptions);
        return {
            close,
            port
        };
    }

    private async getConfig(configName: string | undefined) {
        const config: TopLevelConfig = [];
        const { configurations } = this.options;
        if (configurations && configName) {
            const configDefinition = configurations.get(configName);
            if (!configDefinition) {
                const configNames = Array.from(configurations.keys());
                throw new Error(
                    `cannot find config "${configName}". available configurations: ${configNames.join(', ')}`
                );
            }
            for (const definition of configDefinition) {
                try {
                    if (Array.isArray(definition)) {
                        config.push(...definition);
                    } else {
                        config.push(...(await import(definition.filePath)).default);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
        return config;
    }

    private async startRemoteNodeEnvironment(options: ServerEnvironmentOptions) {
        const remoteNodeEnvironment = await startRemoteNodeEnvironment(cliEntry, {
            inspect: this.options.inspect,
            port: this.options.port
        });
        const port = await remoteNodeEnvironment.getRemotePort();
        const startMessage = new Promise(resolve => {
            remoteNodeEnvironment.subscribe(message => {
                if (isEnvironmentStartMessage(message)) {
                    resolve();
                }
            });
        });
        remoteNodeEnvironment.postMessage({
            id: 'start',
            envName: options.name,
            data: options
        } as IEnvironmentStartMessage);

        await startMessage;

        return {
            close: async () => {
                await new Promise<void>(resolve => {
                    remoteNodeEnvironment.subscribe(message => {
                        if (message.id === 'close') {
                            resolve();
                        }
                    });
                    remoteNodeEnvironment.postMessage({ id: 'close', envName: options.name } as IEnvironmentMessage);
                });
                return remoteNodeEnvironment.dispose();
            },
            port
        };
    }

    public getNodeEnvironments(featureName: string) {
        const nodeEnvs = new Set<IEnvironment>();

        const { features } = this.options;
        const featureDefinition = features.get(featureName);
        if (!featureDefinition) {
            const featureNames = Array.from(features.keys());
            throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
        }
        const { resolvedContexts } = featureDefinition;

        const deepDefsForFeature = flattenTree(featureDefinition, f =>
            f.dependencies.map(fName => features.get(fName)!)
        );
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
}
