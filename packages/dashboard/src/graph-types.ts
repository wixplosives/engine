import type { AnyEnvironment } from "@wixc3/engine-core";
import type { IEnvironmentDescriptor } from "@wixc3/engine-runtime-node";

type Name = string
type Type = string

export type SerializedNode = {
    name: string;
    envs: IEnvironmentDescriptor<AnyEnvironment>[]
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