import { expect } from 'chai';
import { translateNodeToHierarchy } from '@wixc3/engine-dashboard/dist/components/feature-graph/utils';
import type { GraphNode } from '../src/graph-types';

const getChildrenByGroup = (nodes: Array<{ group: number }>, targetGroup: number) =>
    nodes.filter(({ group }) => group === targetGroup);

const getGroupNodes = (nodes: Array<{ group: number }>, targetGroup: number, parent?: GraphNode) => ({
    name: targetGroup.toString(),
    group: targetGroup,
    children: getChildrenByGroup(nodes, targetGroup),
    parent,
});

describe('translateNodeToHierarchy', () => {
    it('should group all nodes by groups', () => {
        const nodes = [
            { name: 'a', group: 1 },
            { name: 'b', group: 2 },
            { name: 'c', group: 2 },
            { name: 'd', group: 3 },
        ];
        const root = translateNodeToHierarchy(nodes);
        expect(root.children).to.eql([
            getGroupNodes(nodes, 1, root),
            getGroupNodes(nodes, 2, root),
            getGroupNodes(nodes, 3, root),
        ]);
    });
});
