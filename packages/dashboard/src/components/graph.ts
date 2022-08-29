import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceCollide, Simulation } from "d3-force";
import { drag } from 'd3-drag'
import type { SerializedGraphData } from "../graph-types";
import type { Selection } from 'd3-selection';
import { classes } from './feature-graph.st.css';
import { StratifiedNode, StratifiedLink, stratify, defaultStratifiedNode } from "./graph-utils";
import { generateColorPicker, size, updateLinks, updateNodes } from './graph-drawing-helpers'

export type NodeDatum = StratifiedNode & {
    x: number,
    y: number
}
export type LinkDatum = StratifiedLink<NodeDatum> & {
    id: number
}
export type GroupSelection = Selection<SVGGElement, unknown, null, undefined>;

export function updateGraph({ nodes, links }: SerializedGraphData, stage: GroupSelection) {
    const nodesMap = new Map<string, NodeDatum>(nodes.map((n) => [n.name, {
        ...n,
        ...defaultStratifiedNode,
        x: 0, y: 0
    }]))
    let _links = links.map<LinkDatum>(({ source, target }, i) => ({
        // d3 simulation replaces source and target string with the datum
        //@ts-expect-error
        source, target,
        id: i, distance: 0
    }))
    let _nodes = [...nodesMap.values()]
    let color = generateColorPicker(_nodes)

    const linksGroup = stage.append('g').attr('class', classes.link!)
    const nodesGroup = stage.append('g').attr('class', classes.node!)

    let link = updateLinks(linksGroup, _links, color)
    let node = updateNodes(nodesGroup, _nodes, color)

    node.on('click', (_, d) => {
        stratify(d, _nodes, _links)
        color = generateColorPicker(_nodes)
        updateNodes(nodesGroup, _nodes, color)
        updateLinks(linksGroup, _links.filter(l => l.distance), color)
        sim.nodes(_nodes).alpha(1).alphaTarget(0.1).restart()
    })

    const sim = createSimulation()
    const s = stratify(null, _nodes, _links)
    _nodes = s.nodes
    _links = s.links as LinkDatum[]

    color = generateColorPicker(_nodes)
    node = updateNodes(nodesGroup, _nodes, color)
    updateLinks(linksGroup, _links, color)

    function createSimulation() {
        const sim = forceSimulation(_nodes)
            .force('charge', forceManyBody().strength(-300))
            .force('links', forceLink(_links).id((n: any) => n.name))
            .force("y", forceY((d, _, _nodes) => {
                const hasSelection = _nodes.some(n => (n as any as NodeDatum).isSelected)
                if (hasSelection) {
                    return (d as any as NodeDatum).isConnected ? 0 : 300
                } else {
                    return 0
                }
            })
                .strength(d => (d as any as NodeDatum).isConnected ? 0.1 : 0.4))
            .force('collide', forceCollide(size))
            .force("group", forceX(d => (d as any as NodeDatum).distance * 120)
                .strength(d => (d as any as NodeDatum).isConnected ? 0.4 : 0.1))
            .on('tick', ticked);

        node.call(dragSim(sim) as any)
        return sim;

        function ticked() {
            updateLinks(linksGroup, _nodes.some(n => n.isSelected) ? _links.filter(l => l.distance) : _links, color)
            node.attr("transform", d => `translate(${d.x}, ${d.y})`)
        }

        function dragSim(simulation: Simulation<NodeDatum, undefined>) {
            return drag().on('start', (event, d: any) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            }).on('drag', (event, d: any) => {
                d.fx = event.x;
                d.fy = event.y;
            }).on('end', (event, d: any) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            })
        }
    }
}
