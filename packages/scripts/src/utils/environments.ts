import { flattenTree, EnvironmentTypes } from '@wixc3/engine-core';
import type { IEnvironment, IFeatureDefinition } from '../types';

export function filterEnvironments(
    featureName: string,
    features: Map<string, IFeatureDefinition>,
    envTypes: EnvironmentTypes[] | EnvironmentTypes
) {
    const environmentTypesToFilterBy = Array.isArray(envTypes) ? envTypes : [envTypes];
    const filteredEnvironments = new Set<IEnvironment>();

    const featureDefinition = features.get(featureName);
    if (!featureDefinition) {
        const featureNames = Array.from(features.keys());
        throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.join(', ')}`);
    }
    const { resolvedContexts } = featureDefinition;

    const deepDefsForFeature = flattenTree(featureDefinition, (f) =>
        f.dependencies.map((fName) => features.get(fName)!)
    );
    for (const { exportedEnvs } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (
                environmentTypesToFilterBy.includes(exportedEnv.type) &&
                (!exportedEnv.childEnvName || resolvedContexts[exportedEnv.name] === exportedEnv.childEnvName)
            ) {
                filteredEnvironments.add(exportedEnv);
            }
        }
    }
    return filteredEnvironments;
}
