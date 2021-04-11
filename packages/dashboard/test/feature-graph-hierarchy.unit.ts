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

        // This mock root is to simulate the circular dependency needed for the parent key in each child
        const expectedRoot: { children: Array<GraphNode>; name: 'root'; group: 0 } = {
            children: [],
            name: 'root',
            group: 0,
        };
        expectedRoot.children.push(
            ...[
                {
                    name: '1',
                    group: 1,
                    children: [nodes[0]],
                    parent: expectedRoot,
                },
                {
                    name: '2',
                    group: 2,
                    children: [nodes[1], nodes[2]],
                    parent: expectedRoot,
                },
                {
                    name: '3'.toString(),
                    group: 3,
                    children: [nodes[3]],
                    parent: expectedRoot,
                },
            ]
        );
        expect(root).to.eql(expectedRoot);
    });
});
