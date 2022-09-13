import { scaleLinear } from "d3-scale"
import { interpolateCool, interpolateWarm, schemePastel1 } from "d3-scale-chromatic"
import type { NodeDatum } from "../../graph"

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
