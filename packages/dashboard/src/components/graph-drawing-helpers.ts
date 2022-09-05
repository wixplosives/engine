import type { GroupSelection, LinkDatum, NodeDatum } from "./graph"
import { interpolateCool, interpolateWarm, schemePastel1, schemeSet2 } from 'd3-scale-chromatic'
import { scaleLinear } from "d3-scale";
import { arc } from 'd3-shape'
import { cssStates } from './feature-graph.st.css';
import { capitalize, chain, kebabCase } from "lodash";

export function updateLinks(g: GroupSelection, links: LinkDatum[], color: ColorPicker) {
    const link = g
        .selectAll('path')
        .data(links, (l: any) => l.id)
        // .join('path')
        // .attr('marker-end', d => `url(#${markerId(d)})`)
        // .attr('stroke', color)
        // .attr("d", ({ source: s, target: t }) => `M${s.x},${s.y}A0,0 0 0,1 ${t.x},${t.y}`)
        // .attr('stroke', color)
        .join(
            enter =>
                enter.append('path')
                    .attr('marker-end', d => `url(#${markerId(d)})`)
                    .attr('stroke', color)
            , update => update
                .attr("d", ({ source: s, target: t }) => `M${s.x},${s.y}A0,0 0 0,1 ${t.x},${t.y}`)
                .attr('stroke', color)
            , exit => exit.remove()
        )
    defineArrowheads(g, links, color);
    return link
}

export function updateNodes(g: GroupSelection, nodes: NodeDatum[], color: ColorPicker) {
    const node = g
        .selectAll('g')
        .data(nodes, (d: any) => d.name)
        .join('g')
        .attr('class', ({ isLeaf, isRoot, isSelected }) => cssStates({ isLeaf, isRoot, isSelected }))
    node.selectAll('circle').remove()
    node.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', d => size(d) / 2)
        .attr('fill', 'white')
        .attr('stroke', d => d.isSelected ? interpolateCool(0.4) : 'none')
        .attr('stroke-width', d => size(d) / 20)
        .attr('stroke-dasharray', '2 1')

    node.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', d => size(d) / 2 * 0.8)
        .attr('fill', color)
        .attr('stroke', d => d.isSelected ? interpolateCool(0.6) : 'none')
        .attr('stroke-width', d => size(d) / 20)
        .attr('stroke-dasharray', '1 1')


    const envNames = chain(nodes)
        .flatMap(n => n.envs.map(e => e.name))
        .uniq()
        .sort()
        .compact()
        .value()
    console.log(envNames)

    nodes.flatMap(n => n.envs.map(e => e.name)).filter(i => i).sort()
    const envColor = new Map(
        envNames.map((e, i, { length }) => [e,
            {
                startAngle: i * Math.PI / length - Math.PI / 4,
                endAngle: (i + 1) * Math.PI / length - Math.PI / 4,
                padAngle: 0.05,
                fill: schemeSet2[i]!,
                name: e
            }]
        ))
    const mapEnv = (d: NodeDatum) =>
        chain(d.envs)
            .uniqBy('name')
            .map(e => envColor.get(e.name)!)
            .map(e => ({
                ...e,
                outerRadius: size(d) / 2 * 1.1,
                innerRadius: size(d) / 2 * 0.7,
                node: d.name,
                x: d.x, y: d.y
            })).value()

    const a = arc()
    node.selectAll('g').remove()
    const envGroup = node.append('g')
    envGroup.selectAll('path').data(mapEnv).join('path')
        .attr('d', a)
        .attr('fill', d => d.fill)
        .attr('stroke', 'black')
        .attr('stroke-width', 0.5)
        .attr('id', d => `${d.node}-${d.name}`)

    node.selectChildren('text').remove()
    node.append('text')
        .attr('y', d => `-${kebabCase(d.name).split('-').length / 2 + 0.25}em`)
        .selectAll('tspan')
        .data(d => kebabCase(d.name).split('-').map(capitalize))
        .join('tspan')
        .text(d => d)
        .attr('dy', '1em')
        .attr('x', 0)
    return node;
}

export const size = ({ descendants }: NodeDatum) => 45 + Math.log(1 + descendants) * 15

export const generateColorPicker = (nodes: NodeDatum[]) => {
    if (nodes.some(n => n.isSelected)) {
        const domain = nodes.reduce((d, n) =>
            [
                Math.min(d[0], n.distance), 0, Math.max(d[2], n.distance)
            ] as [number, number, number], [0, 0, 0] as [number, number, number])
        const scale = scaleLinear().domain(domain).range([0.2, 0.5, 1])

        return (d: { distance: number, isSelected?: boolean, source?: { isSelected: boolean, distance: number } }) => {
            if (d.source) {
                return interpolateCool(scale(d.source.distance))
            }
            if (d.distance) {
                return interpolateCool(scale(d.distance))
            }
            if (d.isSelected) {
                return interpolateWarm(0.6)
            }
            return schemePastel1[0]!
        }
    } else {
        return () => schemePastel1[1]!
    }
}
export type ColorPicker = ReturnType<typeof generateColorPicker>

export const markerId = ({ id }: LinkDatum) => `arrowhead-${id}`

function defineArrowheads(linksGroup: GroupSelection, links: LinkDatum[], color: ColorPicker) {
    const defs = linksGroup.selectAll('defs').data([0]).join('defs')
    defs.selectAll("marker")
        .data(links, (d: any) => d.id)
        .join("marker")
        .attr("id", markerId)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", d => {
            const s = size(d.target) / 2 + 11
            return s || 27
        })
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr('fill', color)
        .attr("d", 'M0,-5L10,0L0,5');
}