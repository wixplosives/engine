import type { EnvRuntimeOptions } from "../components/dashboard-ctx";
import type { ServerState } from "./server-types";
import { ENGINE_FEATURE_URL, ENGINE_STATE_URL, FEATURE_GRAPH_URL } from "./consts";
import type { SerializedGraphData } from "./common";

export const fetchServerState = async () => (await (await fetch(ENGINE_STATE_URL)).json()) as ServerState;
export const fetchGraphData = async () => (await (await fetch(FEATURE_GRAPH_URL)).json()) as SerializedGraphData;
export const changeNodeEnvironmentState = async (
    featureName: string,
    configName: string,
    isNodeEnvActive: boolean,
    envRuntimeOptions: EnvRuntimeOptions
) =>
    (await fetch(ENGINE_FEATURE_URL, {
        method: isNodeEnvActive ? 'POST' : 'PUT',
        body: JSON.stringify({
            featureName,
            configName,
            runtimeOptions: envRuntimeOptions[featureName]!.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {} as Record<string, string>),
        }),
        headers: {
            'Content-type': 'application/json',
        },
    })
    ).json();