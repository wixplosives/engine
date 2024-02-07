import { IConfigDefinition, createFeatureEnvironmentsMapping } from '@wixc3/engine-runtime-node';
import {
    IFeatureDefinition,
    OverrideConfigHook,
    createAllValidConfigurationsEnvironmentMapping,
    getResolvedEnvironments,
} from '@wixc3/engine-scripts';
import esbuild from 'esbuild';
import { createEnvironmentsBuildConfiguration } from './create-environments-build-configuration';
import { SetMultiMap } from '@wixc3/patterns';

export function resolveBuildConfigurations({
    features,
    configurations,
    mode,
    configName,
    featureName,
    dev,
    buildPlugins,
    publicPath,
    outputPath,
    extensions,
    buildConditions,
    publicConfigsRoute,
}: {
    features: Map<string, IFeatureDefinition>;
    configurations: SetMultiMap<string, IConfigDefinition>;
    mode: 'development' | 'production';
    configName: string | undefined;
    featureName: string | undefined;
    dev: boolean;
    buildPlugins: esbuild.Plugin[] | OverrideConfigHook;
    publicPath: string;
    outputPath: string;
    extensions: string[] | undefined;
    buildConditions: string[] | undefined;
    publicConfigsRoute: string;
}) {
    const featureEnvironmentsMapping = createFeatureEnvironmentsMapping(features);
    const configMapping = createAllValidConfigurationsEnvironmentMapping(configurations, mode, configName);

    const environments = getResolvedEnvironments({
        featureName,
        features,
        filterContexts: !!featureName,
        findAllEnvironments: false, // ??
    });

    const buildConfigurations = createEnvironmentsBuildConfiguration({
        dev,
        buildPlugins,
        config: [],
        configurations,
        featureEnvironmentsMapping,
        configMapping,
        features,
        environments,
        publicPath,
        outputPath,
        featureName,
        configName,
        extensions,
        buildConditions,
        publicConfigsRoute,
    });
    return { buildConfigurations, featureEnvironmentsMapping, configMapping, environments };
}
