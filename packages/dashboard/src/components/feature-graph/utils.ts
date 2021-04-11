import type { HierarchyPointNode } from 'd3-hierarchy';
import type { GraphNode, Node } from '../../graph-types';

export function translateNodeToHierarchy(features: Array<Node>) {
    const hierarchy: Record<string, GraphNode> = {
        root: { name: 'root', children: [], group: 0 },
    };

    features.forEach(function (c) {
        const group = c.group.toString();

        if (!hierarchy[group]) {
            hierarchy[group] = { name: group, children: [], parent: hierarchy['root'], group: c.group };
            hierarchy['root']!.children.push(hierarchy[group]!);
        }

        hierarchy[group]!.children.push(c);
    });

    return hierarchy['root']!;
}

export function xAccessor(d: HierarchyPointNode<Node>) {
    const angle = ((d.x - 90) / 180) * Math.PI,
        radius = d.y;
    return radius * Math.cos(angle);
}

export function yAccessor(d: HierarchyPointNode<Node>) {
    const angle = ((d.x - 90) / 180) * Math.PI,
        radius = d.y;
    return radius * Math.sin(angle);
}
