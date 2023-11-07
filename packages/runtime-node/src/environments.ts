import { type EnvironmentTypes, flattenTree } from '@wixc3/engine-core';
import type { IStaticFeatureDefinition, IEnvironmentDescriptor } from './types.js';

export function resolveEnvironments(
    featureName: string,
    features: ReadonlyMap<string, IStaticFeatureDefinition>,
    envTypes?: EnvironmentTypes[] | EnvironmentTypes,
    filterByContext = true,
) {
    const environmentTypesToFilterBy = Array.isArray(envTypes) ? envTypes : [envTypes];
    const filteredEnvironments = new Set<IEnvironmentDescriptor>();

    const featureDefinition = features.get(featureName);
    if (!featureDefinition) {
        const featureNames = Array.from(features.keys());
        throw new Error(`cannot find feature ${featureName}. available features: ${featureNames.sort().join(', ')}`);
    }
    const { resolvedContexts } = featureDefinition;
    const deepDefsForFeature = flattenTree(featureDefinition, (f) =>
        f.dependencies.map((fName) => features.get(fName)!),
    );
    for (const { exportedEnvs = [] } of deepDefsForFeature) {
        for (const exportedEnv of exportedEnvs) {
            if (
                (!envTypes || environmentTypesToFilterBy.includes(exportedEnv.type)) &&
                (!filterByContext ||
                    !exportedEnv.childEnvName ||
                    resolvedContexts[exportedEnv.name] === exportedEnv.childEnvName)
            ) {
                filteredEnvironments.add(exportedEnv);
            }
        }
    }
    return filteredEnvironments;
}
