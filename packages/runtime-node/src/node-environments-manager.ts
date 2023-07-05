import { safeListeningHttpServer } from 'create-listening-server';
import type { Socket } from 'net';
import { delimiter } from 'path';
import io from 'socket.io';

import {
    AnyEnvironment,
    BaseHost,
    COM,
    Communication,
    ConfigEnvironmentRecord,
    Message,
    ReadyMessage,
    TopLevelConfig,
} from '@wixc3/engine-core';
import { ENGINE_ROOT_ENVIRONMENT_ID, METADATA_PROVIDER_ENV_ID } from './core-node/constants';
import { IPCHost } from './core-node/ipc-host';
import type { SetMultiMap } from '@wixc3/patterns';

import { resolveEnvironments } from './environments';
import { startRemoteNodeEnvironment } from './remote-node-environment';
import {
    ICommunicationMessage,
    IConfigDefinition,
    IEnvironmentMessage,
    IEnvironmentStartMessage,
    IStaticFeatureDefinition,
    TopLevelConfigProvider,
    isEnvironmentStartMessage,
    IEnvironmentDescriptor,
    MetadataCollectionAPI,
    StartEnvironmentOptions,
    metadataApiToken,
} from './types';
import { runWSEnvironment } from './ws-environment';
import { loadTopLevelConfigs } from './load-top-level-config';

export interface OverrideConfig {
    configName?: string;
    overrideConfig: TopLevelConfig;
}

export interface RunningEnvironment {
    port: number;
    close: () => Promise<void>;
}

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

export class ChildBaseHost extends BaseHost {
    constructor(public parent: BaseHost) {
        super();
    }

    public postMessage(message: Message) {
        this.parent.postMessage(message);
    }

    public postToSelf(message: Message) {
        this.emitMessageHandlers(message);
    }
}

class ChildHostWrapper extends BaseHost {
    constructor(private host: ChildBaseHost) {
        super();
    }
    postMessage(message: Message) {
        this.host.postToSelf(message);
    }
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
    features: Map<string, IStaticFeatureDefinition>;
    bundlePath?: string;
    configurations?: SetMultiMap<string, IConfigDefinition | TopLevelConfig>;
    defaultRuntimeOptions?: Record<string, string | boolean>;
    port: number;
    inspect?: boolean;
    overrideConfig?: TopLevelConfig | TopLevelConfigProvider;
    requiredPaths?: string[];
}

export type LaunchEnvironmentMode = 'forked' | 'same-server' | 'new-server';
export type RunningFeatureIdentification = {
    featureName: string;
    configName?: string;
};

export interface ILaunchEnvironmentOptions {
    nodeEnv: IEnvironmentDescriptor;
    featureName: string;
    bundlePath?: string;
    config: TopLevelConfig;
    options: Record<string, string | boolean>;
    mode?: LaunchEnvironmentMode;
    com: Communication;
    baseHost: BaseHost;
    features: Map<string, IStaticFeatureDefinition>;
}

export class NodeEnvironmentsManager {
    private runningFeatures = new Map<string, { com: Communication; runningEnvironments: RunningEnvironmentRecord }>();

    constructor(
        private socketServer: io.Server,
        private options: INodeEnvironmentsManagerOptions,
        private context: string,
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
        const nodeEnvironments = resolveEnvironments(featureName, features, 'node');
        // checking if already has running environments for this feature
        const runningEnv = this.runningFeatures.get(featureId);
        if (runningEnv) {
            // adding the topology of the already running environments for this feature
            Object.assign(topology, this.getTopologyForRunningEnvironments(runningEnv.runningEnvironments));
        }

        const runningEnvironments: RunningEnvironmentRecord = {};
        const preparedEnvironments: DeclaredEnvironmentRecord = {};

        /**
         * creating a "top level" communication instance for all running node environments, to serve as a router between them.
         *
         * to this communication all environments will be registered using either a base host which uses 'baseHost' as a parent, either IPCHost (in cases when node environments are launched in forked mode).
         *
         * all node environments will receive a "connectedEnvironments" configuration to the communication feature, to provide access to all node environments. (note: this means that when running engine applications using the Applciation API from engine-scripts, node environments communication is implicit. BUT, we do need to encourage the users to still use the COM's 'initializers' in the 'initiating' environment for both concictensy and correctness.
         *
         * in the other side, when a node environment a wants to communicate with node environment b using this mechanism, it uses the 'localNodeEnvironmentInitializer' exported from '@wixc3/engine-core', as the initializer for communicating with environment b (from a).
         *
         * the communication flow is as follows:
         *
         * 'a' sets up a connection to 'b', using 'localNodeEnvironmentInitializer'.
         * 'a' makes an api call to a service provided from 'b'
         * 'a' locates the host to 'b' and sends the message.
         * message arrives to this top level communication
         * message gets re-routed to 'b'
         * 'b' responds back to top level communication which then forwards the message to 'a'
         *
         * if 'b' wants to call an api provided from 'a', it's implicity will do the same thing, but without the need to explicitly call a COM's initializer
         */
        const baseHost = new BaseHost();
        const rootCom = new Communication(baseHost, ENGINE_ROOT_ENVIRONMENT_ID, undefined, undefined, true);

        const metadataProviderHost = new BaseHost();
        // in forked mode we are launching a new process, so metadata is handled from inside forked process
        if (mode !== 'forked') {
            metadataProviderHost.name = METADATA_PROVIDER_ENV_ID;
            rootCom.registerEnv(METADATA_PROVIDER_ENV_ID, metadataProviderHost);
        }

        rootCom.registerAPI<MetadataCollectionAPI>(metadataApiToken, {
            getRuntimeArguments: () => {
                return {
                    basePath: process.cwd(),
                    config: [],
                    featureName,
                    features: [...features.entries()],
                    outputPath: process.cwd(),
                    nodeEntryPath: '',
                    runtimeOptions: Object.entries(runtimeOptions),
                    configName,
                };
            },
        });

        const envHostMapping = new Map<IEnvironmentDescriptor, ChildBaseHost>();
        for (const nodeEnv of nodeEnvironments) {
            const host = new ChildBaseHost(baseHost);
            envHostMapping.set(nodeEnv, host);
            rootCom.registerEnv(nodeEnv.name, new ChildHostWrapper(host));
        }

        for (const nodeEnv of nodeEnvironments) {
            const connectedEnvironments = this.createConnectedEnvMapping(
                envHostMapping,
                nodeEnv,
                mode,
                metadataProviderHost
            );

            const { overrideConfigs, originalConfigName } = this.getOverrideConfig(
                overrideConfigsMap,
                configName,
                nodeEnv.name
            );

            const config: TopLevelConfig = [];

            config.push(COM.use({ config: { topology, connectedEnvironments } }));
            // TODO: pass filterEnv to getConfig?
            config.push(
                ...(await loadTopLevelConfigs(originalConfigName, this.options.configurations)),
                ...overrideConfigs
            );
            const preparedEnvironment = await this.prepareEnvironment({
                nodeEnv,
                featureName,
                bundlePath: this.options.bundlePath,
                config,
                options: {
                    ...defaultRuntimeOptions,
                    ...runtimeOptions,
                },
                mode,
                com: rootCom,
                baseHost,
                features: features,
            });
            topology[nodeEnv.name] = `http://localhost:${preparedEnvironment.port}/${nodeEnv.name}`;
            preparedEnvironments[nodeEnv.name] = preparedEnvironment;
        }

        for (const [envName, preparedEnvironment] of Object.entries(preparedEnvironments)) {
            if (runningEnvironments[envName]) {
                throw new Error(`${envName} is already running`);
            }
            runningEnvironments[envName] = {
                ...(await preparedEnvironment.start()),
                port: preparedEnvironment.port,
            };
        }

        this.runningFeatures.set(featureId, { com: rootCom, runningEnvironments });

        return {
            featureName,
            configName: runtimeConfigName,
            runningEnvironments,
        };
    }

    private createConnectedEnvMapping(
        envHostMapping: Map<IEnvironmentDescriptor<AnyEnvironment>, ChildBaseHost>,
        nodeEnv: IEnvironmentDescriptor<AnyEnvironment>,
        mode: string,
        metadataProviderHost: BaseHost
    ) {
        const connectedEnvironments: Record<string, ConfigEnvironmentRecord> = {};
        for (const [env, host] of envHostMapping) {
            if (env !== nodeEnv) {
                connectedEnvironments[env.name] = { id: env.name, host };
            } else {
                connectedEnvironments[ENGINE_ROOT_ENVIRONMENT_ID] = {
                    id: ENGINE_ROOT_ENVIRONMENT_ID,
                    host,
                    registerMessageHandler: true,
                };

                // in forked mode we are launching a new process, so metadata is handled from inside forked process
                if (mode !== 'forked') {
                    connectedEnvironments[METADATA_PROVIDER_ENV_ID] = {
                        id: METADATA_PROVIDER_ENV_ID,
                        host: metadataProviderHost,
                    };
                }
            }
        }
        return connectedEnvironments;
    }

    private getOverrideConfig(overrideConfigsMap: Map<string, OverrideConfig>, configName?: string, envName?: string) {
        const { overrideConfig: overrideConfigProvider = [] } = this.options;
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
        bundlePath: outputPath,
        config,
        options,
        mode,
        com,
        features,
    }: ILaunchEnvironmentOptions) {
        const { port, inspect } = this.options;

        const nodeEnvironmentOptions: StartEnvironmentOptions = {
            ...nodeEnv,
            bundlePath: outputPath,
            config,
            featureName,
            features: Array.from(features.entries()),
            options: Object.entries(options),
            inspect,
            context: this.context,
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
            // change previous host registration
            com.clearEnvironment(nodeEnv.name);
            com.registerMessageHandler(ipcHost);
            com.registerEnv(nodeEnv.name, ipcHost);
            com.handleReady({ from: nodeEnv.name } as ReadyMessage);
            return {
                port,
                start,
            };
        }

        if (mode === 'new-server') {
            return this.runEnvironmentInNewServer(port, nodeEnvironmentOptions);
        }

        const { start } = runWSEnvironment(this.socketServer, nodeEnvironmentOptions);

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
                let close: () => Promise<void>;
                try {
                    const { close: wsEnvClose } = await runWSEnvironment(
                        socketServer,
                        serverEnvironmentOptions
                    ).start();
                    close = wsEnvClose;
                } catch (e) {
                    await new Promise<void>((res, rej) => socketServer.close((e) => (e ? rej(e) : res())));
                    throw e;
                }
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
                        await new Promise<void>((res, rej) => socketServer.close((e) => (e ? rej(e) : res())));
                        await close();
                    },
                };
            },
            port: realPort,
        };
    }

    private async runRemoteNodeEnvironment(options: StartEnvironmentOptions) {
        const { remoteNodeEnvironment, process: childProc } = await startRemoteNodeEnvironment(cliEntry, {
            inspect: this.options.inspect,
            port: this.options.port,
            socketServerOptions: this.socketServerOptions,
            requiredPaths: this.options.requiredPaths,
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
