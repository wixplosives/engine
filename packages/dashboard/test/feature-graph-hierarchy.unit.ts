import { expect } from 'chai';
import { translateNodeToHierarchy } from '@wixc3/engine-dashboard/dist/graph-utils';
import type { Node, GraphNode } from '@wixc3/engine-dashboard/dist/graph-types';

describe('translateNodeToHierarchy', () => {
    it('should group all nodes by groups', () => {
        const nodes: Node[] = [
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
            {
                name: '1',
                group: 1,
                children: [nodes[0]!],
                parent: expectedRoot,
            },
            {
                name: '2',
                group: 2,
                children: [nodes[1]!, nodes[2]!],
                parent: expectedRoot,
            },
            {
                name: '3'.toString(),
                group: 3,
                children: [nodes[3]!],
                parent: expectedRoot,
            },
        );
        expect(root).to.eql(expectedRoot);
    });
});
