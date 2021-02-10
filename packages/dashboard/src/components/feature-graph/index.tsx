import React, { useEffect } from 'react';
import { cluster, line, curveBundle, select, hierarchy, HierarchyPointNode } from 'd3';
import { classes } from './styles.st.css';

export interface Link {
    source: string | Node;
    target: string | Node;
}

interface Node {
    name: string;
    id: string;
    group: number;
    parent?: Node;
}

export interface GraphData {
    nodes: Node[];
    links: Link[];
}

export interface IFeatureGraphProps {
    selectedFeatureGraph: GraphData;
}

export const FeatureGraph = ({ selectedFeatureGraph }: IFeatureGraphProps) => {
    useEffect(() => {
        const diameter = 600;
        const radius = diameter / 2;
        const innerRadius = radius - 70;

        const graphCluster = cluster<Node>()
            .size([360, innerRadius])
            .separation(function (a, b) {
                return a.parent == b.parent ? 1 : a.parent?.parent == b.parent?.parent ? 2 : 4;
            });

        const graphLine = line<HierarchyPointNode<Node>>().x(xAccessor).y(yAccessor).curve(curveBundle.beta(0.7));

        const svg = select('#graph_root')
            .attr('width', diameter)
            .attr('height', diameter)
            .append('g')
            .attr('transform', 'translate(' + radius + ',' + radius + ')');

        const idToNode: Record<string, Node> = {};

        selectedFeatureGraph.nodes.forEach(function (n: Node) {
            idToNode[n.id] = n;
        });

        selectedFeatureGraph.links.forEach(function (e: Link) {
            e.source = idToNode[e.source as string];
            e.target = idToNode[e.target as string];
        });

        const tree = graphCluster(hierarchy<Node>(featureHierarchy(selectedFeatureGraph.nodes)));

        const leaves = tree.leaves();

        const paths = selectedFeatureGraph.links.map(function (l) {
            var source = leaves.filter(function (d) {
                return d.data === l.source;
            })[0];
            var target = leaves.filter(function (d) {
                return d.data === l.target;
            })[0];
            return source.path(target);
        });

        const link = svg
            .selectAll('.link')
            .data(paths)
            .enter()
            .append('path')
            .attr('class', classes.link)
            .attr('d', graphLine)
            .on('mouseover', function (l) {
                link.style('stroke', null).style('stroke-opacity', null);
                select(this).style('stroke', '#d62333').style('stroke-opacity', 1);
                node.selectAll('circle').style('fill', null);
                node.filter(function (n) {
                    return n === l[0] || n === l[l.length - 1];
                })
                    .selectAll('circle')
                    .style('fill', 'black');
            })
            .on('mouseout', function () {
                link.style('stroke', null).style('stroke-opacity', null);
                node.selectAll('circle').style('fill', null);
            });

        const node = svg
            .selectAll('.node')
            .data(tree.leaves())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', function (d) {
                return 'translate(' + xAccessor(d) + ',' + yAccessor(d) + ')';
            })
            .on('mouseover', function (d) {
                node.style('fill', null);
                select(this).selectAll('circle').style('fill', 'black');
                const nodesToHighlight = paths
                    .map(function (e) {
                        return e[0] === d ? e[e.length - 1] : e[e.length - 1] === d ? e[0] : 0;
                    })
                    .filter(function (d) {
                        return d;
                    });
                node.filter(function (d) {
                    return nodesToHighlight.indexOf(d) >= 0;
                })
                    .selectAll('circle')
                    .style('fill', '#555');
                link.style('stroke-opacity', function (link_d) {
                    return link_d[0] === d || link_d[link_d.length - 1] === d ? 1 : null;
                }).style('stroke', function (link_d) {
                    return link_d[0] === d || link_d[link_d.length - 1] === d ? '#d62333' : null;
                });
            })
            .on('mouseout', function () {
                link.style('stroke-opacity', null).style('stroke', null);
                node.selectAll('circle').style('fill', null);
            });

        node.append('circle')
            .attr('r', 4)
            .attr('class', classes.node_circle)
            .append('title')
            .text(function (d) {
                return d.data.name;
            });

        node.append('text')
            .attr('dy', '0.32em')
            .attr('x', function (d) {
                return d.x < 180 ? 6 : -6;
            })
            .style('text-anchor', function (d) {
                return d.x < 180 ? 'start' : 'end';
            })
            .attr('transform', function (d) {
                return 'rotate(' + (d.x < 180 ? d.x - 90 : d.x + 90) + ')';
            })
            .text(function (d) {
                return `${d.data.group} - ${d.data.id}`;
            });

        function featureHierarchy(features: Array<Node>) {
            const hierarchy: any = {
                root: { name: 'root', children: [] },
            };

            features.forEach(function (c) {
                const chapter = c.group;

                if (!hierarchy[chapter]) {
                    hierarchy[chapter] = { name: chapter, children: [], parent: hierarchy['root'] };
                    hierarchy['root'].children.push(hierarchy[chapter]);
                }

                c.parent = hierarchy[chapter];
                hierarchy[chapter].children.push(c);
            });

            return hierarchy['root'];
        }

        function xAccessor(d: HierarchyPointNode<Node>) {
            const angle = ((d.x - 90) / 180) * Math.PI,
                radius = d.y;
            return radius * Math.cos(angle);
        }

        function yAccessor(d: HierarchyPointNode<Node>) {
            const angle = ((d.x - 90) / 180) * Math.PI,
                radius = d.y;
            return radius * Math.sin(angle);
        }
    });
    return <svg id="graph_root" />;
};

FeatureGraph.displayName = 'FeatureGraph';
