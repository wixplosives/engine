import { flattenTree, EnvironmentTypes } from '@wixc3/engine-core';
import type { IEnvironment, IStaticFeatureDefinition } from './types';

export function getEnvironmntsForFeature(
    featureName: string,
    features: Map<string, IStaticFeatureDefinition>,
    envTypes?: EnvironmentTypes[] | EnvironmentTypes,
    filterByContext = true
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
        f.dependencies ? f.dependencies.map((fName) => features.get(fName)!) : []
    );
    for (const { exportedEnvs = [] } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (
                (!envTypes || environmentTypesToFilterBy.includes(exportedEnv.type)) &&
                (!filterByContext ||
                    !exportedEnv.childEnvName ||
                    resolvedContexts?.[exportedEnv.name] === exportedEnv.childEnvName)
            ) {
                filteredEnvironments.add(exportedEnv);
            }
        }
    }
    return filteredEnvironments;
}

