import _ from "lodash";
import type { SerializedNode as Node } from "../server/common";

type Direction = 'target' | 'source'
const direction = {
    target: -1,
    source: 1
} as const
type Link<N extends Node = Node> = { source: N, target: N }
export type StratifiedLink<N extends Node, L extends Link<N> = Link<N>> = L & { distance: number }
export type StratifiedGraph = ReturnType<typeof stratify>
export const defaultStratifiedNode = {
    distance: 0,
    descendants: 0,
    isSelected: false,
    isLeaf: false,
    isRoot: false,
    isConnected: false
}
export type StratifiedNode<N extends Node = Node> = N & typeof defaultStratifiedNode

const stratifyLinks = <N extends Node, L extends Link<N>>(selected: N | null, links: L[]) => {
    const _links = links as any as StratifiedLink<N>[]
    _links.forEach(l => l.distance = 0)
    if (selected) {
        const visitedNodes = new Set<N>()
        const bfs = (from: Direction, to: Direction, node = selected, depth = 0) => {
            if (node && !visitedNodes.has(node)) {
                visitedNodes.add(node)
                const linked = _links.filter(l => l[from] === node);
                linked.forEach(l => l.distance = depth + direction[from])
                linked.forEach(l => bfs(from, to, l[to], depth + direction[from]))
            }
        }
        bfs('source', 'target')
        visitedNodes.delete(selected)
        bfs('target', 'source')
    }
    return _links
}


const updateNodes = <N extends Node, L extends Link<N>>(selected: N | null, nodes: N[], links: StratifiedLink<N, L>[]) => {
    const maxDepth = links.reduce((max, { distance }) => Math.max(max, distance), 0)
    nodes.forEach(n => {
        Object.assign(n, {
            ...n,
            distance: maxDepth + 1,
            descendants: 0,
            selected: n === selected,
            isLeaf: !links.some(l => l.source === n),
            isRoot: !links.some(l => l.target === n)
        })
    })
    const _nodes = nodes as any as StratifiedNode<N>[]
    const visited = new Set<StratifiedNode<N>>([])
    const dfs = (node?: StratifiedNode<N>): number => {
        if (node && !visited.has(node)) {
            visited.add(node)
            let d = node.descendants
            if (!d) {
                const children = links.filter(l => node === l.source).map(l => l.target as StratifiedNode<N>)
                d = children.reduce((sum, child) => sum + dfs(child), 1)
                node.descendants = d
            }
            return d
        } else {
            return 0
        }
    }
    _nodes.forEach(dfs)
    _nodes.forEach((n) => {
        n.descendants--
        n.isSelected = n === selected
        n.distance = 0
        n.isConnected = n.isSelected
    })
    const _links = links as any as StratifiedLink<StratifiedNode<N>>[]
    if (selected) {
        _links.forEach(({ distance, source, target }) => {
            if (distance !== 0) {
                if (distance > 0) {
                    target.distance = distance
                } else {
                    source.distance = distance
                }
                target.isConnected = true
                source.isConnected = true
            }
        })
    }
    console.log(_nodes, _links)
    return { nodes: _nodes, links: _links }
}

export const stratify = <N extends Node, L extends Link<N>>(selected: N | null, nodes: N[], links: L[]) =>
    updateNodes(
        selected,
        nodes,
        stratifyLinks(selected, links))

export const getNode = <N extends Node>({ nodes }: { nodes: N[] }, name: string) => nodes.find(n => n.name === name)!
