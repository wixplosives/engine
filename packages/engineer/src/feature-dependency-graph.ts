import type { AnyEnvironment, IFeature } from '@wixc3/engine-core';
import type { IEnvironmentDescriptor } from '@wixc3/engine-runtime-node';
import type { IFeatureDefinition } from '@wixc3/engine-scripts';

export type Node = {
    name: string;
    envs: IEnvironmentDescriptor<AnyEnvironment>[]
    packageName: string
}
export type Nodes = Map<string, Node>;
export type Link = {
    source: string;
    target: string;
}

/**
 *
 * @param entry - The entry feature we want to build the graph from
 *
 * recursive function to build a tree of features, their distance from the root and the links between all features
 */
export const buildFeatureLinks = (features: Map<string, IFeatureDefinition>, name: string) => {
    const featuresById = new Map<string, IFeatureDefinition>()
    for (const f of features.values()) {
        featuresById.set(f.exportedFeature.id, f)
    }
    const entry = features.get(name)
    if (entry) {
        return parseNode(entry.exportedFeature)
    } else {
        return { links: [], nodes: [] }
    }

    function parseNode(entry: IFeature, nodes: Nodes = new Map(), links: Link[] = []) {
        const { dependencies, id } = entry;
        const node = nodes.get(id) ?? {
            name: id, 
            envs: featuresById.get(id)?.exportedEnvs || [],
            packageName: featuresById.get(id)?.packageName || ''
        }
        nodes.set(id, node)

        for (const dep of dependencies) {
            links.push({ source: entry.id, target: dep.id });
            if (!nodes.has(dep.id)) {
                parseNode(dep, nodes, links)
            }
        }
        return { links, nodes: [...nodes.values()] };
    };
};



