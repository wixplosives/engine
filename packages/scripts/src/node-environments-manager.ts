import type { Socket } from 'net';
import { delimiter } from 'path';

import io from 'socket.io';
import { safeListeningHttpServer } from 'create-listening-server';
import { COM, TopLevelConfig, SetMultiMap } from '@wixc3/engine-core';

import { startRemoteNodeEnvironment } from './remote-node-environment';
import { runWSEnvironment } from './ws-environment';
import {
    IConfigDefinition,
    IEnvironment,
    IEnvironmentMessage,
    IEnvironmentStartMessage,
    IFeatureDefinition,
    isEnvironmentStartMessage,
    StartEnvironmentOptions,
    TopLevelConfigProvider,
} from './types';
import type { OverrideConfig } from './config-middleware';
import { filterEnvironments } from './utils/environments';

type RunningEnvironments = Record<string, number>;

export interface IRuntimeEnvironment {
    runningEnvironments: RunningEnvironments;
    close: () => Promise<void>;
}

export interface RunEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    overrideConfigsMap?: Map<string, OverrideConfig>;
    mode?: LaunchEnvironmentMode;
}

const cliEntry = require.resolve('../cli');

export interface INodeEnvironmentsManagerOptions {
    features: Map<string, IFeatureDefinition>;
    configurations?: SetMultiMap<string, IConfigDefinition | TopLevelConfig>;
    defaultRuntimeOptions?: Record<string, string | boolean>;
    port: number;
    inspect?: boolean;
    overrideConfig: TopLevelConfig | TopLevelConfigProvider;
}

export type LaunchEnvironmentMode = 'forked' | 'same-server' | 'new-server';
export type RunningFeatureIdentification = {
    featureName: string;
    configName?: string;
};

export interface ILaunchEnvironmentOptions {
    nodeEnv: IEnvironment;
    featureName: string;
    config: TopLevelConfig;
    options: Record<string, string | boolean>;
    mode?: LaunchEnvironmentMode;
}

export class NodeEnvironmentsManager {
    private runningEnvironments = new Map<string, IRuntimeEnvironment>();

    constructor(private socketServer: io.Server, private options: INodeEnvironmentsManagerOptions) {}

    public async runServerEnvironments({
        featureName,
        configName,
        runtimeOptions = {},
        overrideConfigsMap = new Map(),
        mode = 'new-server',
    }: RunEnvironmentOptions) {
        const runtimeConfigName = configName;
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;

        const topology: Record<string, string> = {};
        const runningEnvironments: Record<string, number> = {};
        const disposables: Array<() => unknown> = [];
        const { defaultRuntimeOptions, features } = this.options;

        // checking if already has running environments for this feature
        const runningEnv = this.runningEnvironments.get(featureId);
        if (runningEnv) {
            // adding the topology of the already running environments for this feature
            Object.assign(topology, this.getTopologyForRunningEnvironments(runningEnv.runningEnvironments));
        }
        for (const nodeEnv of filterEnvironments(featureName, features, 'node')) {
            const { overrideConfigs, originalConfigName } = this.getOverrideConfig(
                overrideConfigsMap,
                configName,
                nodeEnv.name
            );
            const config: TopLevelConfig = [];
            config.push(COM.use({ config: { topology } }));
            config.push(...(await this.getConfig(originalConfigName)), ...overrideConfigs);
            const { close, port } = await this.launchEnvironment({
                nodeEnv,
                featureName,
                config,
                options: {
                    ...defaultRuntimeOptions,
                    ...runtimeOptions,
                },
                mode,
            });
            disposables.push(() => close());
            topology[nodeEnv.name] = `http://localhost:${port}/${nodeEnv.name}`;
            runningEnvironments[nodeEnv.name] = port;
        }

        const runningEnvironment: IRuntimeEnvironment = {
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            },
            runningEnvironments,
        };

        this.runningEnvironments.set(featureId, runningEnvironment);

        return {
            featureName,
            configName: runtimeConfigName,
            runningEnvironments,
        };
    }

    private getOverrideConfig(overrideConfigsMap: Map<string, OverrideConfig>, configName?: string, envName?: string) {
        const { overrideConfig: overrideConfigProvider } = this.options;
        const overrideConfig = Array.isArray(overrideConfigProvider)
            ? overrideConfigProvider
            : envName
            ? overrideConfigProvider(envName)
            : [];
        const overrideConfigs = [...overrideConfig];
        if (configName) {
            const currentOverrideConfig = overrideConfigsMap.get(configName);
            if (currentOverrideConfig) {
                const { overrideConfig: topLevelConfig, configName: originalConfigName } = currentOverrideConfig;
                overrideConfigs.push(...topLevelConfig);
                return { overrideConfigs, originalConfigName };
            }
        }
        return { overrideConfigs, originalConfigName: configName };
    }

    private getTopologyForRunningEnvironments(runningEnvironments: RunningEnvironments) {
        return Object.entries(runningEnvironments).reduce<Record<string, string>>((acc, [envName, port]) => {
            acc[envName] = `http://localhost:${port}/${envName}`;
            return acc;
        }, {});
    }

    public getRunningFeatures() {
        const runningFeatures = new Map<RunningFeatureIdentification, RunningEnvironments>();
        for (const [featureId, runningEnvs] of this.runningEnvironments) {
            const [featureName, configName] = featureId.split(delimiter);
            runningFeatures.set({ featureName, configName }, runningEnvs.runningEnvironments);
        }
        return runningFeatures;
    }

    public async closeEnvironment({ featureName, configName }: RunEnvironmentOptions) {
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;

        const runningEnvironment = this.runningEnvironments.get(featureId);

        if (!runningEnvironment) {
            throw new Error(`there are no node environments running for ${featureName} and config ${configName!}`);
        }
        this.runningEnvironments.delete(featureId);
        await runningEnvironment.close();
    }

    public getFeaturesWithRunningEnvironments() {
        return Array.from(this.runningEnvironments.keys()).map((runningFeature) => runningFeature.split(delimiter));
    }

    public getTopology(featureName: string, configName?: string) {
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;
        const topology = this.runningEnvironments.get(featureId);
        if (!topology) return {};
        return this.getTopologyForRunningEnvironments(topology.runningEnvironments);
    }

    public async closeAll() {
        for (const runningEnvironment of this.runningEnvironments.values()) {
            await runningEnvironment.close();
        }
        this.runningEnvironments.clear();
    }

    private async launchEnvironment({ nodeEnv, featureName, config, options, mode }: ILaunchEnvironmentOptions) {
        const { features, port, inspect } = this.options;
        const nodeEnvironmentOptions: StartEnvironmentOptions = {
            ...nodeEnv,
            config,
            featureName,
            features: Array.from(features.entries()),
            options: Object.entries(options),
            inspect,
        };

        if (inspect || mode === 'forked') {
            if (inspect && mode !== 'forked') {
                console.warn(
                    `Cannot inspect env without forking new process. 
                    Launchihg environment ${nodeEnv.name} on remote process.`
                );
            }
            return this.runRemoteNodeEnvironment(nodeEnvironmentOptions);
        }

        if (mode === 'new-server') {
            return await this.runEnvironmentInNewServer(port, nodeEnvironmentOptions);
        }

        const { close } = await runWSEnvironment(this.socketServer, nodeEnvironmentOptions);
        return {
            close,
            port,
        };
    }

    private async runEnvironmentInNewServer(port: number, serverEnvironmentOptions: StartEnvironmentOptions) {
        const { httpServer, port: realPort } = await safeListeningHttpServer(port);
        const socketServer = io(httpServer, {
            pingTimeout: 15_000,
        });
        const { close } = await runWSEnvironment(socketServer, serverEnvironmentOptions);
        const openSockets = new Set<Socket>();
        const captureConnections = (socket: Socket): void => {
            openSockets.add(socket);
            socket.once('close', () => {
                openSockets.delete(socket);
            });
        };
        httpServer.on('connection', captureConnections);
        return {
            port: realPort,
            close: async () => {
                await close();
                httpServer.off('connection', captureConnections);
                for (const socket of openSockets) {
                    socket.destroy();
                }
                await new Promise((res, rej) => socketServer.close((e?: Error) => (e ? rej(e) : res()) as any));
            },
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

    private async runRemoteNodeEnvironment(options: StartEnvironmentOptions) {
        const remoteNodeEnvironment = await startRemoteNodeEnvironment(cliEntry, {
            inspect: this.options.inspect,
            port: this.options.port,
        });
        const port = await remoteNodeEnvironment.getRemotePort();
        const startMessage = new Promise((resolve) => {
            remoteNodeEnvironment.subscribe((message) => {
                if (isEnvironmentStartMessage(message)) {
                    resolve();
                }
            });
        });
        remoteNodeEnvironment.postMessage({
            id: 'start',
            envName: options.name,
            data: options,
        } as IEnvironmentStartMessage);

        await startMessage;

        return {
            close: async () => {
                await new Promise<void>((resolve) => {
                    remoteNodeEnvironment.subscribe((message) => {
                        if (message.id === 'close') {
                            resolve();
                        }
                    });
                    remoteNodeEnvironment.postMessage({ id: 'close', envName: options.name } as IEnvironmentMessage);
                });
                return remoteNodeEnvironment.dispose();
            },
            port,
        };
    }
}
