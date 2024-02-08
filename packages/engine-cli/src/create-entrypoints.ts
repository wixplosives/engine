import { TopLevelConfig } from '@wixc3/engine-core';
import {
    ConfigurationEnvironmentMapping,
    FeatureEnvironmentMapping,
    IConfigDefinition,
} from '@wixc3/engine-runtime-node';
import {
    IFeatureDefinition,
    createMainEntrypoint,
    createNodeEntrypoint,
    createNodeEnvironmentManagerEntrypoint,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/patterns';

export interface CreateEntryPointOptions {
    dev: boolean;
    featureEnvironmentsMapping: FeatureEnvironmentMapping;
    configMapping: ConfigurationEnvironmentMapping;
    configurations: SetMultiMap<string, IConfigDefinition>;
    features: Map<string, IFeatureDefinition>;
    publicPath: string;
    environments: ReturnType<typeof getResolvedEnvironments>;
    config: TopLevelConfig;
    publicConfigsRoute: string;
    featureName?: string;
    configName?: string;
}

export type EntryPoints = {
    webEntryPoints: Map<string, string>;
    nodeEntryPoints: Map<string, string>;
};

export type EntryPointsPaths = {
    webEntryPointsPaths: string[];
    nodeEntryPointsPaths: string[];
};

export function createEntryPoints(
    options: CreateEntryPointOptions,
    jsOutExtension: '.js' | '.mjs',
    nodeFormat: 'esm' | 'cjs',
): EntryPoints {
    const {
        dev,
        publicPath,
        featureName,
        configName,
        environments,
        features,
        configurations,
        config,
        featureEnvironmentsMapping,
        configMapping,
        publicConfigsRoute,
    } = options;

    const mode = dev ? 'development' : 'production';
    const browserTargets = concatIterables(environments.webEnvs.values(), environments.workerEnvs.values());
    const nodeTargets = concatIterables(environments.nodeEnvs.values(), environments.workerThreadEnvs.values());

    const webEntryPoints = new Map<string, string>();
    const nodeEntryPoints = new Map<string, string>();

    const entrypointContent = createNodeEnvironmentManagerEntrypoint({
        featureEnvironmentsMapping,
        configMapping,
        moduleType: nodeFormat,
    });

    nodeEntryPoints.set(`engine-environment-manager${jsOutExtension}`, entrypointContent);

    for (const { env, childEnvs } of browserTargets) {
        const entrypointContent = createMainEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            publicPath,
            publicPathVariableName: 'PUBLIC_PATH',
            configurations,
            mode,
            staticBuild: false,
            publicConfigsRoute,
            config,
        });

        webEntryPoints.set(
            `${env.name}.${env.type === 'webworker' ? 'webworker' : 'web'}${jsOutExtension}`,
            entrypointContent,
        );
    }

    for (const { env, childEnvs } of nodeTargets) {
        const entrypointContent = createNodeEntrypoint({
            features,
            childEnvs,
            env,
            featureName,
            configName,
            configurations,
            mode,
            staticBuild: false,
            publicConfigsRoute: '/configs',
            config,
        });
        nodeEntryPoints.set(`${env.name}.${env.type}${jsOutExtension}`, entrypointContent);
    }
    return { webEntryPoints, nodeEntryPoints };
}

function* concatIterables<T>(...iterables: Iterable<T>[]) {
    for (const iterable of iterables) {
        yield* iterable;
    }
}
