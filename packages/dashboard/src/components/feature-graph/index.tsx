import React, { useEffect, memo } from 'react';
import * as d3 from 'd3';

export interface Link {
    source: string;
    target: string;
}

export interface GraphData {
    nodes: {
        name: string;
        id: string;
        group: number;
    }[];
    links: Link[];
}

export interface IFeatureGraphProps {
    selectedFeatureGraph: GraphData;
}

export const FeatureGraph = memo<IFeatureGraphProps>((selectedFeatureGraph) => {
    useEffect(() => {
        const data = [12, 5, 6, 6, 9, 10];
        const h = 100;
        const w = 100;
        const svg = d3.select('#graph_root').append('svg').attr('width', w).attr('height', h).style('margin-left', 100);

        svg.selectAll('rect')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', (_d, i) => i * 70)
            .attr('y', (d) => h - 10 * d)
            .attr('width', 65)
            .attr('height', (d) => d * 10)
            .attr('fill', 'green');
    }, []);
    return (
        <>
            <div id="graph_root" />
            <pre>{JSON.stringify(selectedFeatureGraph)}</pre>
        </>
    );
});

FeatureGraph.displayName = 'FeatureGraph';
