import { runEngineApp, TopLevelConfig } from '@wixc3/engine-core/src';
import { IFeatureDefinition } from './analyze-feature';
import { getFeatureLoaders } from './feature-loaders';

export interface ICreateNodeEntrypoint {
    featureName: string;
    config?: TopLevelConfig;
    features: IFeatureDefinition[];
    envName: string;
    envChildName?: string;
    options?: Map<string, string>;
}

export async function createNodeEntrypoint({
    config,
    featureName,
    features,
    options,
    envName,
    envChildName
}: ICreateNodeEntrypoint) {
    const featureLoaders = getFeatureLoaders(features, envName, envChildName);
    const { runningFeature } = await runEngineApp({
        config,
        featureLoaders,
        featureName,
        options
    });
    return runningFeature;
}
