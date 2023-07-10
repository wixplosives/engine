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
            console.log(`no environments found for feature ${featureName}`);
            return;
        }

        await Promise.all(envNames.map((envName) => this.open(envName, runtimeOptions)));
    }

    private createEnvironmentFileUrl(envName: string) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }
        // TODO: inject jsOutExtension from the entry point or resolve extensions on disk
        const jsOutExtension = '.mjs';
        console.log(this.importMeta.url, '!');
        return new URL(`${env.env}.${env.envType}${jsOutExtension}`, this.importMeta.url);
    }

    async open(envName: string, runtimeOptions: IRunOptions) {
        const env = this.featureEnvironmentMapping.availableEnvironments[envName];
        if (!env) {
            throw new Error(`environment ${envName} not found`);
        }

        const runningEnv = workerThreadInitializer2({
            communication: this.communication,
            env,
            workerURL: this.createEnvironmentFileUrl(envName),
            argv: new Array(runtimeOptions.entries()).flatMap(([key, value]) =>
                Array.isArray(value) ? value.flatMap((v) => [`--${key}`, String(v)]) : [`--${key}`, String(value)]
            ),
        });

        await runningEnv.initialize();

        this.openEnvironments.add(runningEnv);

        return () => {
            this.openEnvironments.delete(runningEnv);
            return runningEnv.dispose();
        };
    }
}

function parseRuntimeOptions() {
    const { values: args } = parseArgs({
        options: {
            feature: {
                type: 'string',
            },
            require: {
                type: 'string',
                multiple: true,
            },
        },
        strict: true,
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
