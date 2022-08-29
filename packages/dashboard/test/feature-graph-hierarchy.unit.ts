import { expect } from 'chai';
import { cleanGraphData, translateNodeToHierarchy } from '@wixc3/engine-dashboard/src/graph-utils';
import './utils'
import { data as sampleData } from './sample-graph';
import type { GraphNode } from '../src/graph-types';

describe('translateNodeToHierarchy', () => {
    it("creates a tree from data", () => {
        const data = {
            nodes: [
                { name: "a" },
                { name: "b" },
                { name: "c" },
                { name: "d" },
                { name: "e" },
                { name: "f" }
            ],
            links: [
                { source: "a", target: "b" },
                { source: "a", target: "c" },
                { source: "b", target: "d" },
                { source: "d", target: "e" },
                { source: "d", target: "f" },
            ]
        }
        const result = translateNodeToHierarchy(data);
        expect(result).to.have.structure({
            name: '__root',
            children: [
                {
                    name: 'a', children: [
                        {
                            name: 'b', children: [
                                {
                                    name: 'd', children: [
                                        { name: 'e' },
                                        { name: 'f' },
                                    ]
                                }
                            ]
                        },
                        { name: 'c' },
                    ]
                }
            ]
        })
    })
    it('should include each node once', () => {
        const data = cleanGraphData(sampleData)
        const result = translateNodeToHierarchy(data);
        const known = new Set<string>()
        const dfs = ({ name, children }: GraphNode) => {
            expect(known).not.to.include(name)
            known.add(name)
            children.forEach(d => 'children' in d ? dfs(d) : () => void(0))
        }
        dfs(result)
        sampleData.nodes.forEach(({ name }) => expect(known.has(name)))
        expect(known.size).to.equal(sampleData.nodes.length + 1)
    })
    describe('multiple parents', () => {
        it('keeps the deepest parents and drops shallow ones', () => {
            const data = {
                nodes: [
                    { name: 'a' },
                    { name: 'b' },
                    { name: 'c' },
                    { name: 'd' },
                ],
                links: [
                    { source: 'a', target: 'b' },
                    { source: 'a', target: 'c' },
                    { source: 'a', target: 'd' },
                    { source: 'b', target: 'c' },
                    { source: 'b', target: 'd' },
                    { source: 'c', target: 'd' },
                ]
            }
            const result = translateNodeToHierarchy(data);
            expect(result).to.have.structure({
                name: '__root',
                children: [
                    {
                        name: 'a', children: [
                            {
                                name: 'b', children: [
                                    {
                                        name: 'c', children: [
                                            { name: 'd' },
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            })
        })
    })
    describe('multiple roots', () => {
        it('parses unlinked nodes as children of __root', () => {
            const data = {
                nodes: [
                    { name: 'a' },
                    { name: 'b' },
                    { name: 'c' },
                ],
                links: [
                    { source: 'a', target: 'b' },]
            }
            const result = translateNodeToHierarchy(data);
            expect(result).to.have.structure({
                name: "__root",
                children: [{
                    name: 'a', children: [{ name: 'b' }]
                }, { name: 'c' }]

            })

        })
    })
});
