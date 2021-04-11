export interface Link {
    source: string;
    target: string;
}

export interface Node {
    name: string;
    group: number;
}

export interface GraphData {
    nodes: Node[];
    links: Link[];
}

export interface IFeatureGraphProps {
    selectedFeatureGraph: GraphData;
}

export interface GraphNode extends Node {
    children: Array<GraphNode | Node>;
    parent?: GraphNode;
}
