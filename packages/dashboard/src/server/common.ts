import type { IEnvironmentDescriptor } from "@wixc3/engine-runtime-node";

export const ENGINE_FEATURE_URL = `/engine-feature`
export const ENGINE_STATE_URL = `/engine-state`
export const FEATURE_GRAPH_URL = `/feature-graph`

type Name = string
type Type = string

export type SerializedNode = {
    name: string;
    envs: Omit<IEnvironmentDescriptor,'env'>[]
    api: Record<Name, Type>
    packageName: string
}

export type SerializedLink = {
    source: string;
    target: string;
}

export interface SerializedGraphData {
    nodes: SerializedNode[];
    links: SerializedLink[];
}

export interface IFeatureGraphProps {
    selectedFeatureGraph: SerializedGraphData;
    selected: string;
    setSelected: (name: string) => void;
}