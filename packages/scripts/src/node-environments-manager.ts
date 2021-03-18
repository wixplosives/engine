import type { Socket } from 'net';
import { delimiter } from 'path';

import io from 'socket.io';
import { safeListeningHttpServer } from 'create-listening-server';
import { TopLevelConfig, SetMultiMap, Communication, BaseHost, COM } from '@wixc3/engine-core';

import { startRemoteNodeEnvironment } from './remote-node-environment';
import { runWSEnvironment } from './ws-environment';
import {
    IConfigDefinition,
    IEnvironment,
    IEnvironmentMessage,
    IEnvironmentStartMessage,
    IFeatureDefinition,
    IExtenalFeatureDescriptor,
    isEnvironmentStartMessage,
    StartEnvironmentOptions,
    TopLevelConfigProvider,
    ICommunicationMessage,
} from './types';
import type { OverrideConfig } from './config-middleware';
import { getEnvironmntsForFeature } from './utils/environments';
import { IPCHost } from '@wixc3/engine-core-node';

type RunningEnvironment = {
    port: number;
    close: () => Promise<void>;
};

type RunningEnvironmentRecord = Record<string, RunningEnvironment>;

type DeclaredEnvironmentRecord = Record<
    string,
    {
        start: () => Promise<{ close: () => Promise<void> }>;
        port: number;
    }
>;

export interface IRuntimeEnvironment {
    runningEnvironments: RunningEnvironmentRecord[];
}

export interface RunEnvironmentOptions {
    featureName: string;
    configName?: string;
    runtimeOptions?: Record<string, string | boolean>;
    overrideConfigsMap?: Map<string, OverrideConfig>;
    mode?: LaunchEnvironmentMode;
}

const cliEntry = require.resolve('./remote-node-entry');

export interface INodeEnvironmentsManagerOptions {
    features: Map<string, IFeatureDefinition>;
    configurations?: SetMultiMap<string, IConfigDefinition | TopLevelConfig>;
    defaultRuntimeOptions?: Record<string, string | boolean>;
    port: number;
    inspect?: boolean;
    overrideConfig: TopLevelConfig | TopLevelConfigProvider;
    externalFeatures: IExtenalFeatureDescriptor[];
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
    externalFeatures?: IExtenalFeatureDescriptor[];
    com: Communication;
    baseHost: BaseHost;
}
export const ENGINE_COMMUNICATION_NAME = '_engine_node_env_manager_';

export class NodeEnvironmentsManager {
    private runningFeatures = new Map<string, { com: Communication; runningEnvironments: RunningEnvironmentRecord }>();

    constructor(
        private socketServer: io.Server,
        private options: INodeEnvironmentsManagerOptions,
        private socketServerOptions?: Partial<io.ServerOptions>
    ) {}

    public async runServerEnvironments({
        featureName,
        configName,
        runtimeOptions = {},
        overrideConfigsMap = new Map<string, OverrideConfig>(),
        mode = 'new-server',
    }: RunEnvironmentOptions) {
        const runtimeConfigName = configName;
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;
        const topology: Record<string, string> = {};
        const { defaultRuntimeOptions, features } = this.options;
        const nodeEnvironments = getEnvironmntsForFeature(featureName, features, 'node');

        // checking if already has running environments for this feature
        const runningEnv = this.runningFeatures.get(featureId);
        if (runningEnv) {
            // adding the topology of the already running environments for this feature
            Object.assign(topology, this.getTopologyForRunningEnvironments(runningEnv.runningEnvironments));
        }
        const runningEnvironments: RunningEnvironmentRecord = {};
        const preparedEnvironments: DeclaredEnvironmentRecord = {};

        // creating a "top level" communication instance for all running node environment, to serve as a router between them.
        // to this communication all environments will be registered using wither a base host which decends from 'baseHost' (baseHost.open() is triggered later), either IPCHost (in cases when node environments are launched in forked mode).
        // in the other side, when node environment a wants to communicate with node environment b, is declares that the host of environment b is the parent of the base hpst of environment a, which is 'baseHost' itself.
        // we can just use the 'localNodeEnvironmentInitializer' exported from '@wixc3/engine-core'
        const baseHost = new BaseHost();
        const com = new Communication(baseHost, ENGINE_COMMUNICATION_NAME, undefined, undefined, true);

        // retrieving all future topology of the node environments
        // doing this so that node environments will be launched only after topology is populated
        // so they will receive the full topology and be able to connect to the new environment through a socket connection - if desired.
        for (const nodeEnv of nodeEnvironments) {
            const { overrideConfigs, originalConfigName } = this.getOverrideConfig(
                overrideConfigsMap,
                configName,
                nodeEnv.name
            );
            const config: TopLevelConfig = [];
            config.push(COM.use({ config: { topology } }));
            config.push(...(await this.getConfig(originalConfigName)), ...overrideConfigs);
            const env = await this.prepareEnvironment({
                nodeEnv,
                featureName,
                config,
                options: {
                    ...defaultRuntimeOptions,
                    ...runtimeOptions,
                },
                mode,
                externalFeatures: this.options.externalFeatures,
                com,
                baseHost,
            });
            topology[nodeEnv.name] = `http://localhost:${env.port}/${nodeEnv.name}`;
            preparedEnvironments[nodeEnv.name] = env;
        }

        for (const [envName, env] of Object.entries(preparedEnvironments)) {
            if (runningEnvironments[envName]) {
                throw new Error(`${envName} is already running`);
            }
            runningEnvironments[envName] = {
                close: (await env.start()).close,
                port: env.port,
            };
        }

        this.runningFeatures.set(featureId, { com, runningEnvironments });

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

    private getTopologyForRunningEnvironments(runningEnvironments: RunningEnvironmentRecord) {
        return Object.entries(runningEnvironments).reduce<Record<string, string>>((acc, [envName, { port }]) => {
            acc[envName] = `http://localhost:${port}/${envName}`;
            return acc;
        }, {});
    }

    public getRunningFeatures() {
        const runningFeatures = new Map<RunningFeatureIdentification, RunningEnvironmentRecord>();
        for (const [featureId, { runningEnvironments }] of this.runningFeatures) {
            const [featureName, configName] = featureId.split(delimiter) as [string, ...(string | undefined)[]];
            runningFeatures.set({ featureName, configName }, runningEnvironments);
        }
        return runningFeatures;
    }

    public async closeEnvironment({
        featureName,
        configName,
    }: Pick<RunEnvironmentOptions, 'featureName' | 'configName'>) {
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;

        const { runningEnvironments, com } = this.runningFeatures.get(featureId) ?? {};

        if (!runningEnvironments || !com) {
            throw new Error(`there are no node environments running for ${featureName} and config ${configName!}`);
        }
        com.dispose();
        for (const env of Object.values(runningEnvironments)) {
            await env.close();
        }
        this.runningFeatures.delete(featureId);
    }

    public getFeaturesWithRunningEnvironments() {
        return Array.from(this.runningFeatures.keys()).map((runningFeature) => runningFeature.split(delimiter));
    }

    public getTopology(featureName: string, configName?: string) {
        const featureId = `${featureName}${configName ? delimiter + configName : ''}`;
        const { runningEnvironments } = this.runningFeatures.get(featureId) ?? {};
        if (!runningEnvironments) return {};

        return this.getTopologyForRunningEnvironments(runningEnvironments);
    }

    public async closeAll() {
        const allClosed: Promise<void>[] = [];
        for (const runningEnvironmentForFeature of this.runningFeatures.values()) {
            runningEnvironmentForFeature.com.dispose();
            for (const env of Object.values(runningEnvironmentForFeature.runningEnvironments)) {
                allClosed.push(env.close());
            }
        }
        await Promise.all(allClosed);
        this.runningFeatures.clear();
    }

    private async prepareEnvironment({
        nodeEnv,
        featureName,
        config,
        options,
        mode,
        externalFeatures = [],
        com,
        baseHost,
    }: ILaunchEnvironmentOptions) {
        const { features, port, inspect } = this.options;

        const nodeEnvironmentOptions: StartEnvironmentOptions = {
            ...nodeEnv,
            config,
            featureName,
            features: Array.from(features.entries()),
            options: Object.entries(options),
            inspect,
            externalFeatures,
        };

        if (inspect || mode === 'forked') {
            if (inspect && mode !== 'forked') {
                console.warn(
                    `Cannot inspect env without forking new process. 
                    Launchihg environment ${nodeEnv.name} on remote process.`
                );
            }
            const { childProcess, port, start } = await this.runRemoteNodeEnvironment(nodeEnvironmentOptions);

            const ipcHost = new IPCHost(childProcess);
            com.registerEnv(nodeEnv.name, ipcHost);
            com.registerMessageHandler(ipcHost);
            return {
                port,
                start,
            };
        }

        const host = baseHost.open();
        com.registerEnv(nodeEnv.name, host);

        if (mode === 'new-server') {
            return await this.runEnvironmentInNewServer(port, { ...nodeEnvironmentOptions, host });
        }

        const { start } = runWSEnvironment(this.socketServer, { ...nodeEnvironmentOptions, host });

        return {
            start,
            port,
        };
    }

    private async runEnvironmentInNewServer(port: number, serverEnvironmentOptions: StartEnvironmentOptions) {
        const { httpServer, port: realPort } = await safeListeningHttpServer(port);
        const socketServer = new io.Server(httpServer, { cors: {}, ...this.socketServerOptions });

        return {
            start: async () => {
                const { close } = await runWSEnvironment(socketServer, serverEnvironmentOptions).start();
                const openSockets = new Set<Socket>();
                const captureConnections = (socket: Socket): void => {
                    openSockets.add(socket);
                    socket.once('close', () => {
                        openSockets.delete(socket);
                    });
                };

                httpServer.on('connection', captureConnections);
                return {
                    close: async () => {
                        httpServer.off('connection', captureConnections);

                        for (const socket of openSockets) {
                            socket.destroy();
                        }
                        await new Promise<void>((res, rej) =>
                            socketServer.close((e) => {
                                if (e) {
                                    rej(e);
                                } else {
                                    res();
                                }
                            })
                        );
                        await close();
                    },
                };
            },
            port: realPort,
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
                        config.push(...((await import(definition.filePath)) as { default: TopLevelConfig }).default);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }
        return config;
    }

    private async runRemoteNodeEnvironment(options: StartEnvironmentOptions) {
        const { remoteNodeEnvironment, process: childProc } = await startRemoteNodeEnvironment(cliEntry, {
            inspect: this.options.inspect,
            port: this.options.port,
        });

        const port = await remoteNodeEnvironment.getRemotePort();

        return {
            start: async () => {
                const startMessage = new Promise<void>((resolve) => {
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
                            const closeSubscriber = (message: ICommunicationMessage): void => {
                                if (message.id === 'close') {
                                    remoteNodeEnvironment.unsubscribe(closeSubscriber);
                                    resolve();
                                }
                            };
                            remoteNodeEnvironment.subscribe(closeSubscriber);
                            remoteNodeEnvironment.postMessage({
                                id: 'close',
                                envName: options.name,
                            } as IEnvironmentMessage);
                        });
                        return remoteNodeEnvironment.dispose();
                    },
                };
            },
            port,
            childProcess: childProc,
        };
    }
}
