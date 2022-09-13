import type { GroupSelection, LinkDatum } from "../../graph"
import { ColorPicker, size } from "./common";

export function updateLinks(g: GroupSelection, links: LinkDatum[], color: ColorPicker) {     
    defineArrowheads(g, links, color);
    return  g
        .selectChildren('path')
        .data(links, (l: any) => l.id)
        .join('path')
        .attr('marker-end', d => `url(#${markerId(d)})`)
        .attr('stroke', color)
        .attr("d", ({ source: s, target: t }) => `M${s.x},${s.y}A0,0 0 0,1 ${t.x},${t.y}`)
        .attr('stroke', color)
}


export const markerId = ({ id }: LinkDatum) => `arrowhead-${id}`

function defineArrowheads(linksGroup: GroupSelection, links: LinkDatum[], color: ColorPicker) {
    const defs = linksGroup.select('defs');
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