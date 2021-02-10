import type { Feature } from '@wixc3/engine-core';

// { featureName, depth of dep from root feature }
export type FeatureDepth = Record<string, number>;

/**
 *
 * @param entry - The entry feature we want to build the graph from
 * @param visitedFeatures - a record of features and their distance from the root
 * @param level - the current level we are from the root (will translate to the distance from the root)
 *
 * recursive function to build a tree of features, their distance from the root and the links between all features
 */
export const buildFeatureLinks = (entry: Feature, visitedFeatures: FeatureDepth, level: number) => {
    const links: Array<{
        source: string;
        target: string;
    }> = [];
    const { dependencies } = entry;
    for (const dep of dependencies) {
        links.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
        }
    }
    for (const dep of dependencies) {
        if (visitedFeatures[dep.id] === level + 1) {
            links.push(...buildFeatureLinks(dep, visitedFeatures, level + 1));
        }
    }
    return links;
};
