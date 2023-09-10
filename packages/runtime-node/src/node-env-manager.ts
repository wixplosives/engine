import { AnyEnvironment, BaseHost, Communication, ConfigModule, IRunOptions } from '@wixc3/engine-core';
import { SetMultiMap } from '@wixc3/patterns';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { WsServerHost } from './core-node/ws-node-host';
import { dynamicImport } from './dynamic-import';
import { resolveEnvironments } from './environments';
import { launchEngineHttpServer } from './launch-http-server';
import { IStaticFeatureDefinition } from './types';
import { workerThreadInitializer2 } from './worker-thread-initializer2';

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
}

export class NodeEnvManager {
    id = 'node-environment-manager';
    openEnvironments = new SetMultiMap<string, RunningNodeEnvironment>();
    communication: Communication;
    constructor(
        private importMeta: { url: string },
        private featureEnvironmentMapping: FeatureEnvironmentMapping,
        private configMapping: ConfigurationEnvironmentMapping,
    ) {
        this.communication = new Communication(new BaseHost(this.id), this.id, {}, {}, true, {});
    }
    async autoLaunch() {
        const runtimeOptions = parseRuntimeOptions();

        const featureName = runtimeOptions.get('feature');

        if (!featureName || typeof featureName !== 'string') {
            throw new Error('feature is a required for autoLaunch');
        }

        const envNames = this.featureEnvironmentMapping.featureToEnvironments[featureName];

        if (!envNames) {
            console.log(`[ENGINE]: no environments found for feature ${featureName}`);
            return;
        } else {
            console.log(`[ENGINE]: found the following environments for feature ${featureName}:\n${envNames}`);
        }

        await Promise.all(envNames.map((envName) => this.open(envName, runtimeOptions)));
        const staticDirPath = fileURLToPath(new URL('../web', this.importMeta.url));
        const { port, socketServer, app } = await launchEngineHttpServer({ staticDirPath });

        app.get('/configs/*', (req, res) => {
            const reqEnv = req.query.env as string;
            if (typeof reqEnv !== 'string') {
                res.status(400).end('env is required');
                return;
            }
            const requestedConfig: string = (req.params as any)[0] as string;
            console.log(`[ENGINE]: requested config ${requestedConfig} for env ${reqEnv}`);
            if (!requestedConfig || requestedConfig === 'undefined') {
                res.json([]);
                return;
            }

            this.loadEnvironmentConfigurations(reqEnv, requestedConfig)
                .then((configs) => {
                    res.json(configs.flat());
                })
                .catch((e) => {
                    console.error(e);
                    res.status(500).end(e.stack);
                });
        });

        const host = new WsServerHost(socketServer);
        this.communication.registerMessageHandler(host);
        console.log(`[ENGINE]: http server is listening on http://localhost:${port}`);
    }

    private async loadEnvironmentConfigurations(envName: string, configName: string) {
        const mappingEntry = this.configMapping[configName];
        if (!mappingEntry) {
            return [];
        }
        const { common, byEnv } = mappingEntry;
        const configFiles = [...common, ...(byEnv[envName] ?? [])];
        return await Promise.all(
            configFiles.map(async (filePath) => {
                try {
                    const configModule = (await dynamicImport(pathToFileURL(filePath))).default as ConfigModule;
                    console.log(`[ENGINE]: loaded config file ${filePath} for env ${envName} successfully`);
                    return configModule.default ?? configModule;
                } catch (e) {
                    throw new Error(`Failed evaluating config file: ${filePath}`, { cause: e });
                }
            }),
        );
    }

    private createEnvironmentFileUrl(envName: string) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }
        const jsOutExtension = this.importMeta.url.endsWith('.mjs') ? '.mjs' : '.js';
        return new URL(`${env.env}.${env.envType}${jsOutExtension}`, this.importMeta.url);
    }

    async open(envName: string, runtimeOptions: IRunOptions) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }

        const argv = toNonPositionalArgv(runtimeOptions);
        console.log(`[ENGINE]: Opening environment ${envName} with argv ${argv.join(' ')}`);
        const runningEnv = workerThreadInitializer2({
            communication: this.communication,
            env,
            workerURL: this.createEnvironmentFileUrl(envName),
            argv,
        });

        await runningEnv.initialize();
        console.log(`[ENGINE]: Environment ${runningEnv.id} is ready`);
        this.openEnvironments.add(envName, runningEnv);

        return () => {
            this.openEnvironments.delete(envName, runningEnv);
            return runningEnv.dispose();
        };
    }
}

function toNonPositionalArgv(runtimeOptions: IRunOptions) {
    const argv: string[] = [];
    for (const [key, value] of runtimeOptions.entries()) {
        if (Array.isArray(value)) {
            for (const v of value) {
                argv.push(`--${key}=${String(v)}`);
            }
        } else {
            argv.push(`--${key}=${String(value)}`);
        }
    }
    return argv;
}

// TODO: use in node entry point template
function parseRuntimeOptions() {
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
        if (envNames.length) {
            featureToEnvironments[feature.scopedName] = envNames;
        }
    }
    return { featureToEnvironments, availableEnvironments };
}
