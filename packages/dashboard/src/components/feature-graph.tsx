import React, { memo, useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import type { IFeatureGraphProps } from '../graph-types';
import { updateGraph } from './graph';
import { zoom } from 'd3-zoom'

export const FeatureGraph = memo(({ selectedFeatureGraph, selected, setSelected }: IFeatureGraphProps) => {
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        if (!svgRef.current) return

        // Clear Graph content
        const svg = select(svgRef.current)
            .attr('width', '100%')
            .attr('height', '100%')
        const centerSvgContent = () => {
            const box = svg.node()?.getClientRects()?.[0]
            if (box) {
                const { width: w, height: h } = box
                svg.attr('viewBox', [-w / 2, -h / 2, w, h])
            }
        }
        svg.on('resize', centerSvgContent)
        centerSvgContent()

        svg.selectAll('*').remove()
        const stage = svg.append('g').attr('class', 'stage')

        const zoomBehavior = zoom().on('zoom', function handleZoom(e) {
            stage.attr('transform', e.transform);
        })
        svg.call(zoomBehavior as any)

        // Translate raw graph data to hierarchy
        updateGraph(selectedFeatureGraph, select, setSelected, stage);
    }, [svgRef.current]);
    return <svg ref={svgRef} />;
});

FeatureGraph.displayName = 'FeatureGraph';
