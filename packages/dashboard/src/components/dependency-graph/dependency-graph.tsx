import React, { useContext, useEffect, useRef, useState } from 'react';
import { select, Selection } from 'd3-selection';
import { GroupSelection, updateGraph } from '../graph';
import { zoom } from 'd3-zoom'
import { classes } from './feature-graph.st.css'
import { FeaturesGraphCtx, SelectCtx } from '../dashboard-ctx';

export const DependencyGraph = () => {
    const [selected, setSelected] = useContext(SelectCtx);
    const [featuresGraph] = useContext(FeaturesGraphCtx);
    const svgRef = useRef<SVGSVGElement>(null)
    const [stage, setStage] = useState<Stage | null>(null)

    useEffect(() => {
        if (svgRef.current) {
            const svg = createCenteredSvg(svgRef);
            setStage(createZoombleStage(svg))
        }
    }, [svgRef.current, setStage]);

    useEffect(()=>{
        if (stage) {
            updateGraph(featuresGraph, selected.feature, () => { }, stage);
        }
    }, [stage, selected.feature, featuresGraph])

 
    return <svg ref={svgRef} />;
};

export type Stage = {
    stage:GroupSelection,
    nodes:GroupSelection,
    links:GroupSelection
}

function createZoombleStage(svg: Selection<SVGSVGElement | null, unknown, null, undefined>) {
    svg.selectAll('*').remove();
    let nodes!: GroupSelection,
        links!: GroupSelection
    const stage = svg.append('g').attr('class', 'stage').call(
        g => {
            links = g.append('g').attr('class', classes.link!)
            links.append('defs')
            nodes = g.append('g').attr('class', classes.node!)
        }
    )

    const zoomBehavior = zoom().on('zoom', function handleZoom(e) {
        stage.attr('transform', e.transform);
    });
    svg.call(zoomBehavior as any);
    return { stage, nodes, links };
}

function createCenteredSvg(svgRef: React.RefObject<SVGSVGElement>) {
    const svg = select(svgRef.current)
        .attr('width', '100%')
        .attr('height', '100%');
    const centerSvgContent = () => {
        const box = svg.node()?.getClientRects()?.[0];
        if (box) {
            const { width: w, height: h } = box;
            svg.attr('viewBox', [-w / 2, -h / 2, w, h]);
        }
    };
    svg.on('resize', centerSvgContent);
    centerSvgContent();
    return svg;
}

