import type { Value } from '@wixc3/engine-core/src/entities/value';
import { selection } from 'd3-selection';
import { features } from 'process';
import React, { createContext } from 'react';
import type { valid } from 'semver';
import type { SerializedGraphData } from '../server/common';
import type { ServerState } from '../server-types';

type WithSetter<T> = [T, (v: T) => void]
function withSetter<T>(v: T) {
    return [v, () => { }] as WithSetter<T>
}
// ServerStateCtx
export const defaultServerState: ServerState = {
    features: {},
    featuresWithRunningNodeEnvs: []
}
export const ServerStateCtx = createContext(withSetter(defaultServerState))

// FeaturesGraphCtx
export const defaultFeaturesGraph: SerializedGraphData = { nodes: [], links: [] };
export const FeaturesGraphCtx = createContext(withSetter(defaultFeaturesGraph))
// SelectCtx
export const defaultSelection = {
    feature: '',
    fixture: '',
    config: ''
}
export const SelectCtx = createContext(withSetter(defaultSelection));

// EnvRuntimeOptionsCtx
export const defaultRuntimeOption = {
    key: '',
    value: ''
}
export type RuntimeOption = typeof defaultRuntimeOption
export type EnvName = string
export type EnvRuntimeOptions = Record<EnvName, RuntimeOption[]>
export const defaultEnvRuntimeOptions: EnvRuntimeOptions = {}
export const EnvRuntimeOptionsCtx = createContext(withSetter(defaultEnvRuntimeOptions))
// TODO remove
export interface RuntimeOptionsContainerProps {
    onOptionAdded: () => void;
    runtimeOptions: RuntimeOption[];
    setRuntimeArguments: (options: RuntimeOption[]) => void;
    actionBtnClassName?: string;
}
// CtxProvider: putting all the Ctx into one wrapper
type DashboardCtx = {
    selection: WithSetter<typeof defaultSelection>,
    features: WithSetter<typeof defaultFeaturesGraph>,
    serverState: WithSetter<typeof defaultServerState>,
    envRuntimeOptions: WithSetter<typeof defaultEnvRuntimeOptions>
    children: React.ReactElement | React.ReactElement[]
}
export const CtxProvider = ({
    selection,
    features,
    serverState,
    envRuntimeOptions,
    children
}: DashboardCtx) =>
    <EnvRuntimeOptionsCtx.Provider value={envRuntimeOptions}>
        <FeaturesGraphCtx.Provider value={features}>
            <SelectCtx.Provider value={selection}>
                <ServerStateCtx.Provider value={serverState}>
                    {children}
                </ServerStateCtx.Provider>
            </SelectCtx.Provider>
        </FeaturesGraphCtx.Provider>
    </EnvRuntimeOptionsCtx.Provider>
