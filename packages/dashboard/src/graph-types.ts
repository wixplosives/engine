import type { Node, Link } from '@wixc3/engineer'

export {Node, Link}

export interface SerializedGraphData {
    nodes: Node[];
    links: Link[];
}

export interface IFeatureGraphProps {
    selectedFeatureGraph: SerializedGraphData;
}

export interface GraphNode extends Node {
    children: Array<GraphNode | Node>;
    parent?: GraphNode;
}
