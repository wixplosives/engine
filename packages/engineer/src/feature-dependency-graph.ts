import type { FeatureClass } from '@wixc3/engine-core';

// { featureName, depth of dep from root feature }
export type Nodes = Record<string, { name: string; group: number }>;

/**
 *
 * @param entry - The entry feature we want to build the graph from
 *
 * recursive function to build a tree of features, their distance from the root and the links between all features
 */
export const buildFeatureLinks = (entry: FeatureClass) => {
    const nodes: Nodes = {};
    const links = buildFeatureLinksHelper(entry, nodes, 0);
    return { nodes: Object.values(nodes), links };
};

const buildFeatureLinksHelper = (entry: FeatureClass, visitedFeatures: Nodes, level: number) => {
    const featureLinks: Array<{
        source: string;
        target: string;
    }> = [];
    const { id } = entry;
    const dependencies = entry.dependencies();
    if (!visitedFeatures[id]) {
        visitedFeatures[id] = { name: id, group: level };
    }
    for (const dep of dependencies) {
        featureLinks.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = { name: dep.id, group: level + 1 };
        }
    }
    for (const dep of dependencies) {
        if (visitedFeatures[dep.id]!.group === level + 1) {
            featureLinks.push(...buildFeatureLinksHelper(dep, visitedFeatures, level + 1));
        }
    }
    return featureLinks;
};
