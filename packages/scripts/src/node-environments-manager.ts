import bodyParser from 'body-parser';
import { Router } from 'express';
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

export interface IRuntimeEnvironment {
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
export class NodeEnvironmentsManager {
    public topology = new Map<string, Record<string, string>>();
    private runningEnvironments = new Map<string, IRuntimeEnvironment>();

    constructor(private socketServer: io.Server, private options: INodeEnvironmentsManagerOptions) {}
    public async runServerEnvironments({ featureName, configName, runtimeOptions = {} }: RunEnvironmentOptions) {
        if (this.runningEnvironments.has(featureName)) {
            throw new Error(`node environment for ${featureName} already running`);
        }
        const topology: Record<string, string> = {};
        const disposables: Array<() => unknown> = [];
        const { defaultRuntimeOptions } = this.options;
        for (const nodeEnv of this.getNodeEnvironments(featureName)) {
            const { close, port } = await this.launchEnvironment(
                nodeEnv,
                featureName,
                [
                    COM.use({ config: { topology: this.topology.get(featureName) } }),
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
            }
        };

        this.topology.set(featureName, topology);

        this.runningEnvironments.set(featureName, runningEnvironment);
    }

    public async closeEnvironment({ featureName }: RunEnvironmentOptions) {
        const runningEnvironment = this.runningEnvironments.get(featureName);
        if (!runningEnvironment) {
            throw new Error(`there are no node environments running for ${featureName}`);
        }
        this.topology.delete(featureName);
        this.runningEnvironments.delete(featureName);
        await runningEnvironment.close();
    }

    public getFeaturesWithRunningEnvironments() {
        return Array.from(this.runningEnvironments.keys());
    }

    public async closeAll() {
        for (const runningEnvironment of this.runningEnvironments.values()) {
            await runningEnvironment.close();
        }
        this.runningEnvironments.clear();
    }

    public middleware() {
        const router = Router();
        router.use(bodyParser.json());
        router.put('/node-env', async (req, res) => {
            const { configName, featureName, runtimeOptions: options }: RunEnvironmentOptions = req.body;
            try {
                await this.runServerEnvironments({
                    configName,
                    featureName,
                    runtimeOptions: options
                });
                res.json({
                    result: 'success'
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error && error.message
                });
            }
        });

        router.delete('/node-env', async (req, res) => {
            const { featureName }: RunEnvironmentOptions = req.body;
            try {
                await this.closeEnvironment({ featureName });
                res.json({
                    result: 'success'
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error && error.message
                });
            }
        });

        router.get('/node-env', (_req, res) => {
            try {
                const data = this.getFeaturesWithRunningEnvironments();
                res.json({
                    result: 'success',
                    data
                });
            } catch (error) {
                res.status(404).json({
                    result: 'error',
                    error: error && error.message
                });
            }
        });

        return router;
    }

    private async launchEnvironment(
        nodeEnv: IEnvironment,
        featureName: string,
        config: Array<[string, object]>,
        options: Record<string, string | boolean>
    ) {
        const { features, port, inspect } = this.options;
        const serverEnvironmentOptions: ServerEnvironmentOptions = {
            ...nodeEnv,
            config,
            featureName,
            features: Array.from(features.entries()),
            options: Object.entries(options)
        };

        if (inspect) {
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
