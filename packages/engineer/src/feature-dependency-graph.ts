import type { Feature } from '@wixc3/engine-core';

export const buildFeatureLinks = (entry: Feature, visitedFeatures: { [propName: string]: number }, level: number) => {
    const res: Array<{
        source: string;
        target: string;
    }> = [];
    const deps = entry.dependencies as Array<Feature>;
    for (const dep of deps) {
        res.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
        }
    }
    for (const dep of deps) {
        if (visitedFeatures[dep.id] === level + 1) {
            res.push(...buildFeatureLinks(dep, visitedFeatures, level + 1));
        }
    }
    return res;
};
