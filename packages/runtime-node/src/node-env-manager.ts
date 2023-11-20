import { AnyEnvironment, BaseHost, Communication, ConfigModule, IRunOptions } from '@wixc3/engine-core';
import { SetMultiMap } from '@wixc3/patterns';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { WsServerHost } from './core-node/ws-node-host';
import { resolveEnvironments } from './environments';
import { launchEngineHttpServer } from './launch-http-server';
import { IStaticFeatureDefinition, PerformanceMetrics } from './types';
import { workerThreadInitializer2 } from './worker-thread-initializer2';
import { bindMetricsListener } from './metrics-utils';

export type ConfigFilePath = string;

export interface ConfigurationEnvironmentMappingEntry {
    common: ConfigFilePath[];
    byEnv: Record<string, ConfigFilePath[]>;
}

export type ConfigurationEnvironmentMapping = Record<string, ConfigurationEnvironmentMappingEntry>;

export interface RunningNodeEnvironment {
    id: string;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
    getMetrics(): Promise<PerformanceMetrics>;
}

export class NodeEnvManager {
    id = 'node-environment-manager';
    openEnvironments = new SetMultiMap<string, RunningNodeEnvironment>();
    communication = new Communication(new BaseHost(this.id), this.id, {}, {}, true, {});
    constructor(
        private importMeta: { url: string },
        private featureEnvironmentMapping: FeatureEnvironmentMapping,
        private configMapping: ConfigurationEnvironmentMapping,
    ) {}
    private initInjectRuntimeConfigConfig(options: IRunOptions) {
        const rawConfigOption = options.get('topLevelConfig');
        if (typeof rawConfigOption === 'string') {
            if (rawConfigOption === 'undefined') {
                return [];
            }
            const parsedConfig = JSON.parse(rawConfigOption);
            return Array.isArray(parsedConfig) ? parsedConfig : [parsedConfig];
        } else if (rawConfigOption) {
            throw new Error('topLevelConfig must be a string if provided');
        }
        return [];
    }
    public async autoLaunch() {
        const runtimeOptions = parseRuntimeOptions();

        const verbose = Boolean(runtimeOptions.get('verbose')) ?? false;
        const topLevelConfigInject = this.initInjectRuntimeConfigConfig(runtimeOptions) ?? [];
        bindMetricsListener(() => this.collectMetricsFromAllOpenEnvironments());
        await this.runFeatureEnvironments(verbose, runtimeOptions);

        const staticDirPath = fileURLToPath(new URL('../web', this.importMeta.url));
        const { port, socketServer, app } = await launchEngineHttpServer({ staticDirPath });

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
        this.communication.registerMessageHandler(host);
        console.log(`[ENGINE]: http server is listening on http://localhost:${port}`);

        if (process.send) {
            process.send({ port });
        }
    }

    private async runFeatureEnvironments(verbose: boolean, runtimeOptions: Map<string, string | boolean | undefined>) {
        const featureName = runtimeOptions.get('feature');
        if (!featureName || typeof featureName !== 'string') {
            throw new Error('feature is a required for autoLaunch');
        }

        const hasFeatureDef = Object.hasOwn(this.featureEnvironmentMapping.featureToEnvironments, featureName);
        if (!hasFeatureDef) {
            throw new Error(`[ENGINE]: no environments found for feature ${featureName}`);
        }

        const envNames = this.featureEnvironmentMapping.featureToEnvironments[featureName] || [];

        if (verbose) {
            console.log(`[ENGINE]: found the following environments for feature ${featureName}:\n${envNames}`);
        }

        const disposes = await Promise.all(
            envNames.map((envName) => this.initializeWorkerEnvironment(envName, runtimeOptions, verbose)),
        );

        return () => Promise.all(disposes.map((dispose) => dispose()));
    }

    private async loadEnvironmentConfigurations(envName: string, configName: string, verbose = false) {
        const mappingEntry = this.configMapping[configName];
        if (!mappingEntry) {
            return [];
        }
        const { common, byEnv } = mappingEntry;
        const configFiles = [...common, ...(byEnv[envName] ?? [])];
        const loadedConfigs = await Promise.all(
            configFiles.map(async (filePath) => {
                try {
                    // TODO: make it work in esm via injection
                    const configModule = (await require(filePath)).default as ConfigModule;
                    if (verbose) {
                        console.log(`[ENGINE]: loaded config file ${filePath} for env ${envName} successfully`);
                    }
                    return configModule.default ?? configModule;
                } catch (e) {
                    throw new Error(`Failed evaluating config file: ${filePath}`, { cause: e });
                }
            }),
        );

        return loadedConfigs;
    }

    private createEnvironmentFileUrl(envName: string) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }
        const jsOutExtension = this.importMeta.url.endsWith('.mjs') ? '.mjs' : '.js';
        return new URL(`${env.env}.${env.envType}${jsOutExtension}`, this.importMeta.url);
    }

    private async initializeWorkerEnvironment(envName: string, runtimeOptions: IRunOptions, verbose = false) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }

        const runningEnv = workerThreadInitializer2({
            communication: this.communication,
            env,
            workerURL: this.createEnvironmentFileUrl(envName),
            runtimeOptions,
        });

        await runningEnv.initialize();
        this.openEnvironments.add(envName, runningEnv);
        if (verbose) {
            console.log(`[ENGINE]: Environment ${runningEnv.id} is ready`);
        }

        return () => {
            this.openEnvironments.delete(envName, runningEnv);
            return runningEnv.dispose();
        };
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
