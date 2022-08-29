import { expect } from "chai"
import { StratifiedGraph, stratify, getNode, defaultStratifiedNode, StratifiedNode, StratifiedLink } from '@wixc3/engine-dashboard/src/components/graph-utils'
import { uniqBy } from "lodash"


describe('stratify', () => {
    describe("links", () => {
        describe('when no node is selected', () => {
            it('sets all the distances to 0', () => {
                const data = graph(`
                        a -> b -> c -> d
                    `)
                stratify(null, data.nodes, data.links)
                expect(data.links).to.eql([
                    link('a', 'b', 0, data),
                    link('b', 'c', 0, data),
                    link('c', 'd', 0, data),
                ])
            })
        })
        describe('when a node is selected', () => {
            it('sets link distance from ', () => {
                const data = graph(`
                    a -> b -> c -> d
                `)
                stratify(getNode(data, 'b'), data.nodes, data.links)
                expect(data.links).to.eql([
                    link('a', 'b', -1, data),
                    link('b', 'c', 1, data),
                    link('c', 'd', 2, data),
                ])
            })

            it('sets distance to SHORTEST DOWNSTREAM distance', () => {
                const data = graph(`
                    a -> b -> c -> d
                    a -> d 
                `)
                stratify(getNode(data, 'a'), data.nodes, data.links)
                expect(data.links).to.eql([
                    link('a', 'b', 1, data),
                    link('b', 'c', 2, data),
                    link('c', 'd', 3, data),
                    link('a', 'd', 1, data),
                ])
            })

            it('sets distance to the SHORTEST UPSTREAM distance', () => {
                const data = graph(`
                    a -> b -> c -> d
                    a -> d 
                `)
                stratify(getNode(data, 'd'), data.nodes, data.links)
                expect(data.links).to.eql([
                    link('a', 'b', -3, data),
                    link('b', 'c', -2, data),
                    link('c', 'd', -1, data),
                    link('a', 'd', -1, data),
                ])
            })
            it('set backflow links distance to 0', () => {
                const data = graph(`
                    a -> b -> c -> d
                    a -> d 
                `)
                stratify(getNode(data, 'b'), data.nodes, data.links)
                expect(data.links).to.eql([
                    link('a', 'b', -1, data),
                    link('b', 'c', 1, data),
                    link('c', 'd', 2, data),
                    link('a', 'd', 0, data),
                ])
            })
        })
    })
    describe("nodes", () => {
        it('detects roots and leaves', () => {
            const data = graph(`
                a -> b -> c
                d
                e -> f
            `)
            stratify(getNode(data, 'a'), data.nodes, data.links)
            expect(getNode(data, 'a')).includes({ isLeaf: false, isRoot: true })
            expect(getNode(data, 'b')).includes({ isLeaf: false, isRoot: false })
            expect(getNode(data, 'c')).includes({ isLeaf: true, isRoot: false })
            expect(getNode(data, 'd')).includes({ isLeaf: true, isRoot: true })
            expect(getNode(data, 'e')).includes({ isLeaf: false, isRoot: true })
            expect(getNode(data, 'f')).includes({ isLeaf: true, isRoot: false })
        })
        it('calculates the number of descendants', () => {
            const data = graph(`
                a -> b -> c
                a -> c
                a -> d                 
            `)
            stratify(getNode(data, 'a'), data.nodes, data.links)
            expect(getNode(data, 'a')).includes({ descendants: 3 })
            expect(getNode(data, 'b')).includes({ descendants: 1 })
            expect(getNode(data, 'c')).includes({ descendants: 0 })
            expect(getNode(data, 'd')).includes({ descendants: 0 })
        })
        describe('when no node is selected', () => {
            it('sets all nodes selected to false', () => {
                const data = graph(`
                    a -> b -> c
                `)
                stratify(null, data.nodes, data.links)
                data.nodes.forEach(n => expect(n.isSelected).to.equal(false))
            })
            it('sets all nodes distance=0, isConnected=false', () => {
                const data = graph(`
                    a -> b -> c
                `)
                stratify(null, data.nodes, data.links)
                data.nodes.forEach(n => expect(n.distance).to.equal(0))
                data.nodes.forEach(n => expect(n.isConnected).to.equal(false))
            })
        })
        describe('when a node is selected', () => {
            it('sets distance and isConnected of connected nodes', () => {
                const data = graph(`
                    a -> b -> c
                `)
                stratify(getNode(data, 'b'), data.nodes, data.links)
                expect(getNode(data, 'a')).includes({ distance: -1, isConnected: true })
                expect(getNode(data, 'b')).includes({ distance: 0, isConnected: true })
                expect(getNode(data, 'c')).includes({ distance: 1, isConnected: true })
            })
            it('sets distance for unconnected nodes to 0 ans isConnected to false', () => {
                const data = graph(`
                    a -> b -> c
                    d -> e
                `)
                stratify(getNode(data, 'd'), data.nodes, data.links)
                expect(getNode(data, 'a')).includes({ distance: 0, isConnected: false })
                expect(getNode(data, 'b')).includes({ distance: 0, isConnected: false })
                expect(getNode(data, 'c')).includes({ distance: 0, isConnected: false })
            })
        })

    })
})

type Node = { name: string }
type Link = { source: Node, target: Node }
const link = (source: string, target: string, distance: number, data: StratifiedGraph) => ({
    source: getNode(data, source),
    target: getNode(data, target),
    distance
})
const graph = (g: string) => {
    const chains = g.split('\n').map(l => l.trim()).filter(i => i)
    const nodesByChain = chains.map(chain => chain.split('->').map<StratifiedNode>(n => ({ ...defaultStratifiedNode, name: n.trim() })))
    const nodes = uniqBy(nodesByChain.flatMap(i => i), 'name')
    return {
        nodes,
        links: nodesByChain.flatMap(
            chain => chain.reduce(
                (acc: StratifiedLink<StratifiedNode>[], { name }, i, { [i + 1]: target }) =>
                    target
                        ? [...acc, {
                            source: getNode({ nodes }, name),
                            target: getNode({ nodes }, target.name),
                            distance: 0
                        }]
                        : acc
                , [])
        )
    }
}

describe('test helpers - graph', () => {
    it('parses a chain of nodes', () => {
        const data = graph('a -> b -> c')
        expect(data).to.eql({
            nodes: [
                { ...defaultStratifiedNode, name: 'a' },
                { ...defaultStratifiedNode, name: 'b' },
                { ...defaultStratifiedNode, name: 'c' },
            ],
            links: [
                { source: getNode(data, 'a'), target: getNode(data, 'b'), distance: 0 },
                { source: getNode(data, 'b'), target: getNode(data, 'c'), distance: 0 },
            ]
        })
    })
    it('parses multiple lines as different chains', () => {
        const data = graph(`
            a -> b -> c
            a -> d -> c        
        `)
        expect(data).to.eql({
            nodes: [
                { ...defaultStratifiedNode, name: 'a' },
                { ...defaultStratifiedNode, name: 'b' },
                { ...defaultStratifiedNode, name: 'c' },
                { ...defaultStratifiedNode, name: 'd' },
            ],
            links: [
                { source: 'a', target: 'b' },
                { source: 'b', target: 'c' },
                { source: 'a', target: 'd' },
                { source: 'd', target: 'c' },
            ].map(({ source, target }) =>
            ({
                source: getNode(data, source),
                target: getNode(data, target),
                distance: 0
            }))
        })
    })
    it("uses node reference for links' source and target", () => {
        const { links, nodes } = graph(`
            a -> b
            a -> c
        `)
        expect(links[0]?.source).to.equal(nodes[0])
        expect(links[0]?.target).to.equal(nodes[1])
        expect(links[1]?.source).to.equal(nodes[0])
        expect(links[1]?.target).to.equal(nodes[2])
    })
})