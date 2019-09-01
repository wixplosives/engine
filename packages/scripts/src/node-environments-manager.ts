import bodyParser from 'body-parser';
import { Router } from 'express';
import { join } from 'path';
import io from 'socket.io';

import { SetMultiMap } from '@file-services/utils';
import { flattenTree, TopLevelConfig } from '@wixc3/engine-core';

import { RemoteNodeEnvironment } from './remote-node-environment';
import { runNodeEnvironment } from './run-node-environment';
import {
    IConfigDefinition,
    IEnvironmaneStartMessage,
    IEnvironment,
    IEnvironmentMessage,
    IFeatureDefinition,
    isEnvironmentStartMessage,
    ServerEnvironmentOptions
} from './types';

export interface IRuntimeEnvironment {
    close: () => Promise<void>;
    topology: Record<string, string>;
}

export interface RunEnvironmentOptions {
    featureName: string;
    configName?: string;
    options?: Record<string, string>;
}

const remoteEnvironmentEntryFile = join(__dirname, '..', 'static', 'init-remote-environment.js');
export class NodeEnvironmentsManager {
    public topology = new Map<string, Record<string, string>>();
    private runningEnvironments = new Map<string, IRuntimeEnvironment>();

    constructor(
        private features: Map<string, IFeatureDefinition>,
        private configurations: SetMultiMap<string, IConfigDefinition>,
        private httpServerPort: number,
        private socketServer: io.Server
    ) {}
    public async runEnvironment({ featureName, configName, options = {} }: RunEnvironmentOptions) {
        if (this.runningEnvironments.has(featureName)) {
            throw new Error(`node environment for ${featureName} already running`);
        }
        const topology: Record<string, string> = {};
        const disposables = [] as Array<() => Promise<void>>;

        const config: TopLevelConfig = await this.getConfig(configName);

        for (const nodeEnv of this.getNodeEnvironments(featureName)) {
            const { close, topologyUrl } = await this.launchEnvironment(options, nodeEnv, config, featureName);
            topology[nodeEnv.name] = topologyUrl;
            disposables.push(() => close());
        }

        const runningEnvironment = {
            async close() {
                for (const dispose of disposables) {
                    await dispose();
                }
                disposables.length = 0;
            },
            topology
        } as IRuntimeEnvironment;

        this.topology.set(featureName, runningEnvironment.topology);

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

    public middleware(initialOptions?: Record<string, string>) {
        const router = Router();
        router.use(bodyParser.json());
        router.put('/node-env', async (req, res) => {
            const { configName, featureName, options }: RunEnvironmentOptions = req.body;
            try {
                await this.runEnvironment({ configName, featureName, options: { ...options, ...initialOptions } });
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
        options: Record<string, string>,
        nodeEnv: IEnvironment,
        config: Array<[string, object]>,
        featureName: string
    ) {
        const httpServerPath = `http://localhost:${this.httpServerPort}/`;
        const serverEnvironmentOptions: ServerEnvironmentOptions = {
            ...nodeEnv,
            config,
            featureName,
            features: Array.from(this.features.entries()),
            httpServerPath,
            options: Object.entries(options)
        };

        let environmentPort: number = this.httpServerPort;
        let dispose: () => Promise<void>;
        if (Object.keys(options).includes('inspect')) {
            const { close, port } = await this.startRemoteNodeEnvironment(serverEnvironmentOptions);
            environmentPort = port;
            dispose = close;
        } else {
            const { close } = await runNodeEnvironment(this.socketServer, serverEnvironmentOptions);
            dispose = close;
        }
        return {
            topologyUrl: `http://localhost:${environmentPort}/_ws`,
            close: () => dispose()
        };
    }

    private async getConfig(configName: string | undefined) {
        const config: TopLevelConfig = [];
        if (configName) {
            const configDefinition = this.configurations.get(configName);
            if (!configDefinition) {
                const configNames = Array.from(this.configurations.keys());
                throw new Error(
                    `cannot find config "${configName}". available configurations: ${configNames.join(', ')}`
                );
            }
            for (const { filePath } of configDefinition) {
                try {
                    const { default: topLevelConfig } = await import(filePath);
                    config.push(...topLevelConfig);
                } catch (e) {
                    // tslint:disable-next-line: no-console
                    console.error(e);
                }
            }
        }
        return config;
    }

    private async startRemoteNodeEnvironment(options: ServerEnvironmentOptions) {
        const remoteNodeEnvironment = new RemoteNodeEnvironment(remoteEnvironmentEntryFile);
        const port = await remoteNodeEnvironment.start(true);
        const startMessage = new Promise(resolve => {
            remoteNodeEnvironment.subscribe(message => {
                if (isEnvironmentStartMessage(message)) {
                    resolve();
                }
            });
        });
        const startFeature: IEnvironmaneStartMessage = { id: 'start', envName: options.name, data: options };
        remoteNodeEnvironment.postMessage(startFeature);

        await startMessage;
        return {
            close: async () => {
                await new Promise<void>(resolve => {
                    remoteNodeEnvironment.subscribe(message => {
                        if (message.id === 'close') {
                            resolve();
                        }
                    });
                    const enviroenentCloseServer: IEnvironmentMessage = { id: 'close', envName: options.name };
                    remoteNodeEnvironment.postMessage(enviroenentCloseServer);
                });
                return remoteNodeEnvironment.dispose();
            },
            port
        };
    }

    private getNodeEnvironments(featureName: string) {
        const featureDefinition = this.features.get(featureName);
        if (!featureDefinition) {
            const featureNames = Array.from(this.features.keys());
            throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
        }
        const { resolvedContexts } = featureDefinition;

        const nodeEnvs = new Set<IEnvironment>();
        const deepDefsForFeature = flattenTree(featureDefinition, f =>
            f.dependencies.map(fName => this.features.get(fName)!)
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
