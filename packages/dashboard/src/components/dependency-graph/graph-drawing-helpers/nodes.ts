import type { GroupSelection, NodeDatum } from "../../graph"
import { interpolateCool, schemeSet2 } from 'd3-scale-chromatic'
import { arc } from 'd3-shape'
import { cssStates } from '../feature-graph.st.css';
import { chain, kebabCase } from "lodash";
import { ColorPicker, size } from "./common";
import type { BaseType, Selection } from 'd3-selection'

export const updateNodes = (g: GroupSelection, nodes: NodeDatum[], color: ColorPicker) => g
    .selectAll('g')
    .data(nodes, (d: any) => d.name)
    .join('g')
    .attr('class', ({ isLeaf, isRoot, isSelected }) => cssStates({ isLeaf, isRoot, isSelected }))
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .call(d => addBackgroud(d, color))
    .call(addEnvTag)
    .call(addText)

function addBackgroud(node: Selection<SVGGElement | BaseType, NodeDatum, SVGGElement, unknown>, color: (d: { distance: number; isSelected?: boolean | undefined; source?: { isSelected: boolean; distance: number; } | undefined; }) => string) {
    node.selectAll('circle').remove();
    node.append('circle')
        .attr('r', d => size(d) / 2)
        .attr('fill', 'white')
        .attr('stroke', d => d.isSelected ? interpolateCool(0.4) : 'none')
        .attr('stroke-width', d => size(d) / 20)
        .attr('stroke-dasharray', '2 1');

    node.append('circle')
        .attr('r', d => size(d) / 2 * 0.8)
        .attr('fill', color)
        .attr('stroke', d => d.isSelected ? interpolateCool(0.6) : 'none')
        .attr('stroke-width', d => size(d) / 20)
        .attr('stroke-dasharray', '1 1');
}

const addText = (node: Selection<SVGGElement | BaseType, NodeDatum, SVGGElement, unknown>) => {
    const parseName = ({ name }: NodeDatum) => name.replace(/([A-Z\-])/g, '\n$1').split('\n')
    node.selectChildren('text').remove()
    node.append('text')
        .attr('y', d => `-${parseName(d).length / 2 + 0.25}em`)
        .selectAll('tspan')
        .data(parseName)
        .join('tspan')
        .text(d => d)
        .attr('dy', '1em')
        .attr('x', 0)
}

function addEnvTag(node: Selection<SVGGElement | BaseType, NodeDatum, SVGGElement, unknown>) {
    const envNames = chain(node.data())
        .flatMap(n => n.envs.map(e => e.name))
        .uniq()
        .sort()
        .compact()
        .value();

    node.data().flatMap(n => n.envs.map(e => e.name)).filter(i => i).sort();
    const envColor = new Map(
        envNames.map((e, i, { length }) => [e,
            {
                startAngle: i * Math.PI / length - Math.PI / 4,
                endAngle: (i + 1) * Math.PI / length - Math.PI / 4,
                padAngle: 0.05,
                fill: schemeSet2[i]!,
                name: e
            }]
        ));
    const mapEnv = (d: NodeDatum) => chain(d.envs)
        .uniqBy('name')
        .map(e => envColor.get(e.name)!)
        .map(e => ({
            ...e,
            outerRadius: size(d) / 2 * 1.1,
            innerRadius: size(d) / 2 * 0.7,
            node: d.name,
            x: d.x, y: d.y
        })).value();

    const a = arc();
    node.selectAll('g').remove();
    const envGroup = node.append('g');
    envGroup.selectAll('path').data(mapEnv).join('path')
        .attr('d', a)
        .attr('fill', d => d.fill)
        .attr('stroke', 'black')
        .attr('stroke-width', 0.5)
        .attr('id', d => `${d.node}-${d.name}`);
}
