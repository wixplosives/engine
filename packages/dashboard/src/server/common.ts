import type { IEnvironmentDescriptor } from "@wixc3/engine-runtime-node";

export { ServerState } from './server-types'

type Name = string
type Type = string

export type SerializedNode = {
    name: string;
    envs: Omit<IEnvironmentDescriptor, 'env'>[]
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

