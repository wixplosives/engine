import { AnyEnvironment, BaseHost, Communication, IRunOptions } from '@wixc3/engine-core';
import { workerThreadInitializer2 } from './worker-thread-initializer2';
import { resolveEnvironments } from './environments';
import { IStaticFeatureDefinition } from './types';
import { parseArgs } from 'node:util';

interface RunningNodeEnvironment {
    id: string;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
}

export class NodeEnvManager {
    openEnvironments = new Set<RunningNodeEnvironment>();
    constructor(
        private importMeta: { url: string },
        private featureEnvironmentMapping: FeatureEnvironmentMapping,
        private communication = new Communication(new BaseHost(), 'node-environment-manager', {}, {}, true, {})
    ) {}
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
        this.openEnvironments.add(runningEnv);

        return () => {
            this.openEnvironments.delete(runningEnv);
            return runningEnv.dispose();
        };
    }
}

function toNonPositionalArgv(runtimeOptions: IRunOptions) {
    const argv = [];
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

function parseRuntimeOptions() {
    // const { values: args } = parseArgs({
    //     options: {
    //         feature: {
    //             type: 'string',
    //         },
    //         require: {
    //             type: 'string',
    //             multiple: true,
    //         },
    //     },
    //     strict: true,
    // });

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
    features: ReadonlyMap<string, IStaticFeatureDefinition>
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
