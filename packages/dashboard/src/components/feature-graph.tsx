import React, { useEffect } from 'react';
import { hierarchy, cluster, HierarchyPointNode } from 'd3-hierarchy';
import { line, curveBundle } from 'd3-shape';
import { select } from 'd3-selection';
import { classes } from './feature-graph.st.css';
import { translateNodeToHierarchy, xAccessor, yAccessor } from '../graph-utils';
import type { GraphNode, Node, IFeatureGraphProps } from '../graph-types';

export const FeatureGraph = ({ selectedFeatureGraph }: IFeatureGraphProps) => {
    useEffect(() => {
        // Canvas constants
        const diameter = 600;
        const radius = diameter / 2;
        const innerRadius = radius - 70;

        // Clustering functions
        const graphCluster = cluster<GraphNode>().size([360, innerRadius]);

        // Line rendering function
        const graphLine = line<HierarchyPointNode<Node>>().x(xAccessor).y(yAccessor).curve(curveBundle.beta(0.7));

        // Svg canvas init
        const svg = select('#graph_root')
            .attr('width', diameter)
            .attr('height', diameter)
            .append('g')
            .attr('transform', `translate(${radius},${radius})`);

        // Translate raw graph data to hierarchy
        const tree = graphCluster(hierarchy<GraphNode>(translateNodeToHierarchy(selectedFeatureGraph.nodes)));
        const leaves = tree.leaves() as Array<HierarchyPointNode<Node>>;

        // Translate links between nodes to paths
        const paths = selectedFeatureGraph.links.map(function (l) {
            const source = leaves.filter(function (graphNode) {
                return graphNode.data.name === l.source;
            })[0]!;
            const target = leaves.filter(function (graphNode) {
                return graphNode.data.name === l.target;
            })[0]!;
            return source.path(target);
        });

        // Render links
        const link = svg
            .selectAll('.link')
            .data(paths)
            .enter()
            .append('path')
            .attr('class', classes.link!)
            .attr('d', graphLine)
            .on('mouseover', function (_e, linkedNodes) {
                link.style('stroke', null).style('stroke-opacity', null);
                select(this).style('stroke', '#d62333').style('stroke-opacity', 1);
                node.selectAll('circle').style('fill', null);
                node.filter(function (node) {
                    return node === linkedNodes[0] || node === linkedNodes[linkedNodes.length - 1];
                })
                    .selectAll('circle')
                    .style('fill', 'black');
            })
            .on('mouseout', function () {
                link.style('stroke', null).style('stroke-opacity', null);
                node.selectAll('circle').style('fill', null);
            });

        // Render nodes
        const node = svg
            .selectAll('.node')
            .data(leaves)
            .enter()
            .append('g')
            .attr('class', classes.node!)
            .attr('transform', function (graphNode) {
                return `translate(${xAccessor(graphNode)},${yAccessor(graphNode)})`;
            })
            .on('mouseover', function (_e, graphNode) {
                node.style('fill', null);
                select(this).selectAll('circle').style('fill', 'black');
                const nodesToHighlight = paths
                    .map(function (linkedNodes) {
                        return linkedNodes[0] === graphNode
                            ? linkedNodes[linkedNodes.length - 1]
                            : linkedNodes[linkedNodes.length - 1] === graphNode
                            ? linkedNodes[0]
                            : 0;
                    })
                    .filter(function (d) {
                        return d;
                    });
                node.filter(function (d) {
                    return nodesToHighlight.indexOf(d) >= 0;
                })
                    .selectAll('circle')
                    .style('fill', '#555');
                link.style('stroke-opacity', function (linkedNodes) {
                    return linkedNodes[0] === graphNode || linkedNodes[linkedNodes.length - 1] === graphNode ? 1 : null;
                }).style('stroke', function (linkedNodes) {
                    return linkedNodes[0] === graphNode || linkedNodes[linkedNodes.length - 1] === graphNode
                        ? '#d62333'
                        : null;
                });
            })
            .on('mouseout', function () {
                link.style('stroke-opacity', null).style('stroke', null);
                node.selectAll('circle').style('fill', null);
            });

        // Render node title
        node.append('circle').attr('r', 4).attr('class', classes.node_circle!);

        // Render node text
        node.append('text')
            .attr('dy', '0.32em')
            .attr('x', function (graphNode) {
                return graphNode.x < 180 ? 6 : -6;
            })
            .style('text-anchor', function (graphNode) {
                return graphNode.x < 180 ? 'start' : 'end';
            })
            .attr('transform', function (graphNode) {
                return `rotate(${graphNode.x < 180 ? graphNode.x - 90 : graphNode.x + 90})`;
            })
            .text(function (graphNode) {
                return `${graphNode.data.group} - ${graphNode.data.name}`;
            });
    });
    return <svg id="graph_root" />;
};

FeatureGraph.displayName = 'FeatureGraph';
