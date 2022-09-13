import type { IFeature } from '@wixc3/engine-core';
import type { SerializedGraphData, SerializedLink, SerializedNode } from '@wixc3/engine-dashboard';
import type { IFeatureDefinition } from '@wixc3/engine-scripts';
import { mapValues, omit, uniqBy } from 'lodash';
export type Nodes = Map<string, SerializedNode>;

/**
 *
 * @param features - Feature definition mapped by filename
 *
 * recursive function to build a tree of features, their distance from the root and the links between all features
 */
export const serializeFeaturesGraph = (features: Map<string, IFeatureDefinition>): SerializedGraphData => {
    const links = [] as SerializedLink[]
    const nodes = new Map() as Nodes;
    for (const f of features.values()) {
        const { id:name, api, dependencies } = f.exportedFeature
        if (!isFixture(name)) {
            nodes.set(name, {
                name,
                envs: (f.exportedEnvs || []).map(e => omit(e,'env')),
                packageName: f.packageName || '',
                api: mapValues(api, item => item.constructor.name)
            })
            for (const dep of dependencies) {
                links.push({ source: name, target: dep.id });
            }
        }
    }

    return {
        nodes: [...nodes.values()],
        links: uniqBy(links, l => `"${l.source}" -> "${l.target}"`)
    }
};


function isFixture(name: string) {
    return name.includes('/');
}

