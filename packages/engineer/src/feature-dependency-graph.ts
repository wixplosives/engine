import type { Feature } from '@wixc3/engine-core';

// { featureName, depth of dep from root feature }
export type FeatureDepth = Record<string, number>;

/**
 *
 * @param entry - The entry feature we want to build the graph from
 *
 * recursive function to build a tree of features, their distance from the root and the links between all features
 */
export const buildFeatureLinks = (entry: Feature) => {
    const visitedFeatures: FeatureDepth = {};
    const links = buildFeatureLinksHelper(entry, visitedFeatures, 0);
    return { visitedFeatures, links };
};

const buildFeatureLinksHelper = (entry: Feature, visitedFeatures: FeatureDepth, level: number) => {
    const featureLinks: Array<{
        source: string;
        target: string;
    }> = [];
    const { dependencies, id } = entry;
    if (level === 0) {
        visitedFeatures[id] = 0;
    }
    for (const dep of dependencies) {
        featureLinks.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
        }
    }
    for (const dep of dependencies) {
        if (visitedFeatures[dep.id] === level + 1) {
            featureLinks.push(...buildFeatureLinksHelper(dep, visitedFeatures, level + 1));
        }
    }
    return featureLinks;
};
