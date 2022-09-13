import { createContext } from 'react';
import type { SerializedGraphData } from '../graph-types';
import type { ServerState } from '../server-types';

export const defaultSelection = {
    feature: '',
    fixture: '',
    config: ''
}

// TODO remove
export const defaultServerState: ServerState = {
    features: {},
    featuresWithRunningNodeEnvs: []
}

export type Selection = typeof defaultSelection;
export const defaultDashboardCtx = {
    serverState: { ...defaultServerState },
    featuresGraph: {nodes:[], links:[]} as SerializedGraphData,
    selected: { ...defaultSelection },
    setSelected: (newSelection: Selection) => {}
}

export type IDashboardCtx = typeof defaultDashboardCtx

export const DashboardCtx = createContext<IDashboardCtx>({
     ...defaultDashboardCtx
});
