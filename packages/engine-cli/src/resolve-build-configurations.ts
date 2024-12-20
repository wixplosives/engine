import { IConfigDefinition, createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import { SetMultiMap } from '@wixc3/patterns';
import { createEntryPoints } from './create-entrypoints.js';
import type { IFeatureDefinition } from './types.js';
import { createAllValidConfigurationsEnvironmentMapping } from './configuration-mapping.js';
import { getResolvedEnvironments } from './environments.js';

export function resolveBuildEntryPoints({
    features,
    configurations,
    mode,
    configName,
    featureName,
    dev,
    publicPath,
    publicConfigsRoute,
    jsOutExtension,
    nodeFormat,
    staticBuild,
    buildElectron,
}: {
    features: Map<string, IFeatureDefinition>;
    configurations: SetMultiMap<string, IConfigDefinition>;
    mode: 'development' | 'production';
    configName: string | undefined;
    featureName: string | undefined;
    dev: boolean;
    publicPath: string;
    publicConfigsRoute: string;
    jsOutExtension: '.js' | '.mjs';
    nodeFormat: 'esm' | 'cjs';
    staticBuild: boolean;
    buildElectron?: boolean;
}) {
    const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(features);
    const configMapping = createAllValidConfigurationsEnvironmentMapping(configurations, mode, configName);

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: !!featureName,
        findAllEnvironments: false, // ??
    });

    const entryPoints = createEntryPoints(
        {
            config: [],
            configMapping,
            configurations,
            dev,
            environments,
            featureEnvironmentsMapping,
            features,
            publicConfigsRoute,
            publicPath,
            configName,
            featureName,
            buildElectron,
            staticBuild,
        },
        jsOutExtension,
        nodeFormat,
    );

    return { entryPoints, featureEnvironmentsMapping, configMapping, environments };
}
