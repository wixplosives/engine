import { IConfigDefinition, createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import {
    IFeatureDefinition,
    createAllValidConfigurationsEnvironmentMapping,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import { SetMultiMap } from '@wixc3/patterns';
import { createEntryPoints } from './create-entrypoints';

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
}) {
    const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(features);
    const configMapping = createAllValidConfigurationsEnvironmentMapping(configurations, mode, configName);

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: !!featureName,
        findAllEnvironments: false, // ??
        separateElectronRenderer: false,
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
        },
        jsOutExtension,
        nodeFormat,
    );

    return { entryPoints, featureEnvironmentsMapping, configMapping, environments };
}
