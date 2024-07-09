import {
    AnyEnvironment,
    BaseHost,
    ConfigModule,
    IRunOptions,
    MultiCounter,
    parseInjectRuntimeConfigConfig,
} from '@wixc3/engine-core';
import { IDisposable, SetMultiMap } from '@wixc3/patterns';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { WsServerHost } from './core-node/ws-node-host';
import { resolveEnvironments } from './environments';
import { ILaunchHttpServerOptions, launchEngineHttpServer } from './launch-http-server';
import type { IStaticFeatureDefinition, PerformanceMetrics } from './types';
import { runWorker } from './worker-thread-initializer2';
import { getMetricsFromWorker, bindMetricsListener } from './metrics-utils';
import { rpcCall } from './micro-rpc';

export type ConfigFilePath = string;

export interface ConfigurationEnvironmentMappingEntry {
    common: ConfigFilePath[];
    byEnv: Record<string, ConfigFilePath[]>;
}

export type ConfigurationEnvironmentMapping = Record<string, ConfigurationEnvironmentMappingEntry>;

export interface RunningNodeEnvironment {
    id: string;
    dispose(): Promise<void>;
    getMetrics(): Promise<PerformanceMetrics>;
}

export class NodeEnvManager implements IDisposable {
    private disposables = new Set<() => Promise<void>>();
    isDisposed = () => false;
    dispose = async () => {
        this.isDisposed = () => true;
        for (const disposable of this.disposables) {
            await disposable();
        }
    };
    envInstanceIdCounter = new MultiCounter();
    id = 'node-environment-manager';
    openEnvironments = new SetMultiMap<string, RunningNodeEnvironment>();
    constructor(
        private importMeta: { url: string },
        private featureEnvironmentsMapping: FeatureEnvironmentMapping,
        private configMapping: ConfigurationEnvironmentMapping,
        private loadModules: (modulePaths: string[]) => Promise<unknown> = requireModules,
    ) {}
    public async autoLaunch(runtimeOptions = parseRuntimeOptions(), serverOptions: ILaunchHttpServerOptions = {}) {
        process.env.ENGINE_FLOW_V2_DIST_URL = this.importMeta.url;
        const disposeMetricsListener = bindMetricsListener(() => this.collectMetricsFromAllOpenEnvironments());
        const verbose = Boolean(runtimeOptions.get('verbose')) ?? false;
        const topLevelConfigInject = parseInjectRuntimeConfigConfig(runtimeOptions);

        const staticDirPath = fileURLToPath(new URL('../web', this.importMeta.url));
        const { port, socketServer, app, close } = await launchEngineHttpServer({ staticDirPath, ...serverOptions });

        app.get<[string]>('/configs/*', (req, res) => {
            const reqEnv = req.query.env as string;
            if (typeof reqEnv !== 'string') {
                res.status(400).end('env is required');
                return;
            }
            const requestedConfig = req.params[0];
            if (verbose) {
                console.log(`[ENGINE]: requested config ${requestedConfig} for env ${reqEnv}`);
            }
            if (!requestedConfig || requestedConfig === 'undefined') {
                res.json(topLevelConfigInject);
                return;
            }

            this.loadEnvironmentConfigurations(reqEnv, requestedConfig, verbose)
                .then((configs) => {
                    return res.json(
                        (topLevelConfigInject.length ? [...configs, topLevelConfigInject] : configs).flat(),
                    );
                })
                .catch((e) => {
                    console.error(e);
                    res.status(500).end(e.stack);
                });
        });

        const host = new WsServerHost(socketServer);

        await this.runFeatureEnvironments(verbose, runtimeOptions, host);

        const disposeAutoLaunch = async () => {
            disposeMetricsListener();
            await this.closeAll();
            await host.dispose();
            await close();
        };

        if (this.isDisposed()) {
            await disposeAutoLaunch();
        } else {
            this.disposables.add(disposeAutoLaunch);
        }

        if (process.send) {
            process.send({ port });
        }
        return { port };
    }

    async closeAll() {
        await Promise.all([...this.openEnvironments.values()].map((env) => this.closeEnv(env)));
    }

    private closeEnv(env: RunningNodeEnvironment) {
        this.openEnvironments.delete(env.id, env);
        return env.dispose();
    }

    private async runFeatureEnvironments(
        verbose: boolean,
        runtimeOptions: Map<string, string | boolean | undefined>,
        host: WsServerHost,
    ) {
        const featureName = runtimeOptions.get('feature');
        if (!featureName || typeof featureName !== 'string') {
            throw new Error('feature is a required for autoLaunch');
        }

        const hasFeatureDef = Object.hasOwn(this.featureEnvironmentsMapping.featureToEnvironments, featureName);
        if (!hasFeatureDef) {
            throw new Error(`[ENGINE]: no environments found for feature ${featureName}`);
        }

        const envNames = this.featureEnvironmentsMapping.featureToEnvironments[featureName] || [];

        if (verbose) {
            console.log(`[ENGINE]: found the following environments for feature ${featureName}:\n${envNames}`);
        }

        await Promise.all(
            envNames.map((envName) => this.initializeWorkerEnvironment(envName, runtimeOptions, host, verbose)),
        );
    }

    private async loadEnvironmentConfigurations(envName: string, configName: string, verbose = false) {
        const mappingEntry = this.configMapping[configName];
        if (!mappingEntry) {
            return [];
        }
        const { common, byEnv } = mappingEntry;
        const configFiles = [...common, ...(byEnv[envName] ?? [])];

        try {
            if (verbose) {
                console.log(`[ENGINE]: loading config file for env ${envName} ${configFiles}`);
            }
            return (await this.loadModules(configFiles)) as ConfigModule[];
        } catch (e) {
            throw new Error(`Failed evaluating config file: ${configFiles}`, { cause: e });
        }
    }

    private createEnvironmentFileUrl(envName: string) {
        const env = this.featureEnvironmentsMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }
        const jsOutExtension = this.importMeta.url.endsWith('.mjs') ? '.mjs' : '.js';
        return new URL(`${env.env}.${env.envType}${jsOutExtension}`, this.importMeta.url);
    }

    async initializeWorkerEnvironment(
        envName: string,
        runtimeOptions: IRunOptions,
        host: BaseHost | MessagePort,
        verbose: boolean,
    ) {
        const env = this.featureEnvironmentsMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }
        const envInstanceId =
            env.endpointType === 'single' ? env.env : `${envName}/${this.envInstanceIdCounter.next(envName)}`;
        const worker = runWorker(envInstanceId, this.createEnvironmentFileUrl(envName), runtimeOptions);
        const runningEnv = await connectWorkerToHost(envName, worker, host);

        this.openEnvironments.add(envName, runningEnv);
        if (verbose) {
            console.log(`[ENGINE]: Environment ${runningEnv.id} is ready`);
        }
    }

    async collectMetricsFromAllOpenEnvironments() {
        const metrics = {
            marks: [] as PerformanceEntry[],
            measures: [] as PerformanceEntry[],
        };

        for (const runningEnv of this.openEnvironments.values()) {
            const { marks, measures } = await runningEnv.getMetrics();
            metrics.marks.push(...marks.map((m) => ({ ...m, debugInfo: `${runningEnv.id}:${m.name}` })));
            metrics.measures.push(...measures.map((m) => ({ ...m, debugInfo: `${runningEnv.id}:${m.name}` })));
        }
        return metrics;
    }
}

async function requireModules(modulePaths: string[]) {
    const load = [];
    for (const modulePath of modulePaths) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        load.push(require(modulePath));
    }
    const res = await Promise.all(load);
    return res.map((m) => m.default ?? m);
}

function connectWorkerToHost(envName: string, worker: ReturnType<typeof runWorker>, host: BaseHost | MessagePort) {
    type AnyMessage = { data?: any };
    return new Promise<RunningNodeEnvironment>((res, rej) => {
        const runningEnv: RunningNodeEnvironment = {
            id: envName,
            dispose: async () => {
                worker.removeEventListener('message', handleWorkerMessage);
                worker.removeEventListener('error', handleInitializeError);
                host.removeEventListener('message', handleClientMessage);
                if (process.env.ENGINE_GRACEFUL_TERMINATION !== 'false') {
                    try {
                        await rpcCall(worker, 'terminate', 15000);
                    } catch (e) {
                        console.error(`failed terminating environment gracefully ${envName}, terminating worker.`, e);
                    }
                }
                await worker.terminate();
            },
            getMetrics: async () => {
                return getMetricsFromWorker(worker);
            },
        };
        const ready = () => {
            worker.removeEventListener('error', handleInitializeError);
            res(runningEnv);
        };
        const handleWorkerMessage = (message: AnyMessage) => {
            if (message.data?.type === 'ready') {
                ready();
            }
            host.postMessage(message.data);
        };
        const handleClientMessage = (message: AnyMessage) => {
            worker.postMessage(message.data);
        };
        const handleInitializeError = (e: AnyMessage) => {
            rej(new Error(`failed initializing environment ${envName} with error message: ${JSON.stringify(e.data)}`));
        };

        worker.addEventListener('message', handleWorkerMessage);
        worker.addEventListener('error', handleInitializeError);
        host.addEventListener('message', handleClientMessage);
    });
}

export function parseRuntimeOptions() {
    const { values: args } = parseArgs({
        strict: false,
        allowPositionals: false,
    });

    return new Map(Object.entries(args));
}

export type FeatureEnvironmentMapping = {
    featureToEnvironments: Record<string, string[]>;
    availableEnvironments: Record<string, AnyEnvironment>;
};

/**
 * This function generates a mapping from feature name to the environments it should run.
 */
export function createFeatureEnvironmentsMapping(
    features: ReadonlyMap<string, IStaticFeatureDefinition>,
): FeatureEnvironmentMapping {
    const featureToEnvironments: Record<string, string[]> = {};
    const availableEnvironments: Record<string, AnyEnvironment> = {};
    for (const feature of features.values()) {
        const envs = resolveEnvironments(feature.scopedName, features, ['node'], true);
        const envNames = [];
        for (const envDescriptor of envs.values()) {
            availableEnvironments[envDescriptor.name] = envDescriptor.env;
            envNames.push(envDescriptor.name);
        }
        featureToEnvironments[feature.scopedName] = envNames;
    }
    return { featureToEnvironments, availableEnvironments };
}
