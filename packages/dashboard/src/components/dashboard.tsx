import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { GraphData } from '../graph-types.js';
import { isServerResponseMessage, type RunningEngineFeature, type ServerState } from '../server-types.js';
import { ActionsContainer } from './actions-container.js';
import { useUrlParams, type URLParamsValue } from './dashboard-hooks.js';
import { classes } from './dashboard.st.css';
import { DependencyGraph } from './dependency-graph/dependency-graph.js';
import { FeaturesSelection } from './feature-selection.js';
import { RuntimeOptionsContainer, type IRuntimeOption } from './runtime-options-container.js';
import { Sidebar } from './sidebar/sidebar.js';

export interface IDashboardProps {
    fetchServerState: () => Promise<{
        result: 'success' | 'error';
        data: ServerState;
    }>;
    changeNodeEnvironmentState: (
        featureName: string,
        configName: string,
        isNodeEnvActive: boolean,
        runtimeOptions: Array<IRuntimeOption>,
    ) => Promise<unknown>;
    fetchGraphData: (featureName: string) => Promise<GraphData>;
}

export interface SelectedFeature {
    featureName?: string;
    configName?: string;
    runtimeArguments?: string;
}

interface IDashboardParams {
    user_feature: string | undefined;
    user_config: string | undefined;
}

export interface IDashboardContext {
    serverState: {
        featuresWithRunningNodeEnvs: RunningEngineFeature[];
    };
    params: IDashboardParams;
    setParams: (t: URLParamsValue<'user_feature' | 'user_config'>) => void;
}

export const DashboardContext = createContext<IDashboardContext>({
    serverState: { featuresWithRunningNodeEnvs: [] },
    params: {
        user_config: undefined,
        user_feature: undefined,
    },
    setParams: () => console.warn('setParams was not provided to context'),
});

export const Dashboard = React.memo<IDashboardProps>(function Dashboard({
    fetchServerState,
    changeNodeEnvironmentState,
    fetchGraphData,
}) {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {},
    });
    const [firstFeatureName] = Object.keys(serverState.features);
    const [params, setParams] = useUrlParams({
        user_feature: firstFeatureName,
        user_config: undefined,
    });

    const configNames = useMemo(
        () => serverState.features[params.user_feature || '']?.configurations ?? [],
        [params.user_feature, serverState.features],
    );
    const [firstConfigName] = configNames;
    const [runtimeArguments, setRuntimeArguments] = useState<Array<IRuntimeOption>>([
        {
            key: '',
            value: '',
        },
    ]);

    const onServerEnvironmentStatusChange = useCallback(
        async (isNodeEnvActive: boolean) => {
            const serverResponse = await changeNodeEnvironmentState(
                params.user_feature!,
                params.user_config || firstConfigName!,
                !isNodeEnvActive,
                runtimeArguments,
            );
            if (isServerResponseMessage(serverResponse)) {
                const serverStateResponse = await fetchServerState();
                setServerState(serverStateResponse.data);
            } else {
                console.error(serverResponse);
            }
        },
        [
            changeNodeEnvironmentState,
            params.user_feature,
            params.user_config,
            firstConfigName,
            runtimeArguments,
            fetchServerState,
        ],
    );

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const serverResponse = await fetchServerState();
            setServerState(serverResponse.data);
        };

        possibleFeaturesRequest().catch((error) => {
            console.error(error);
        });
    }, [fetchServerState]);

    const hasNodeEnvironments =
        !!params.user_feature && !!serverState.features[params.user_feature]?.hasServerEnvironments;

    const addRuntimeOption = useCallback(
        () => setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]),
        [runtimeArguments, setRuntimeArguments],
    );

    const isNodeEnvRunning = !!serverState.featuresWithRunningNodeEnvs.find(
        ([featureName, configName]) =>
            params.user_feature === featureName &&
            ((!params.user_feature && !configName) || (configName && params.user_config === configName)),
    );

    const handleSelectedFeature = useCallback(
        (featureName = '', configName = '') => {
            setParams({ user_feature: featureName, user_config: configName });
        },
        [setParams],
    );
    serverState.featuresWithRunningNodeEnvs;

    return (
        <DashboardContext.Provider
            value={{
                serverState: { featuresWithRunningNodeEnvs: serverState.featuresWithRunningNodeEnvs },
                params,
                setParams,
            }}
        >
            <div className={classes.root}>
                <Sidebar />
                <div className={classes.content}>
                    <FeaturesSelection
                        features={serverState.features}
                        onSelected={handleSelectedFeature}
                        selectedConfig={params.user_config}
                        selectedFeature={params.user_feature}
                    />
                    {hasNodeEnvironments && (
                        <RuntimeOptionsContainer
                            onOptionAdded={addRuntimeOption}
                            runtimeOptions={runtimeArguments}
                            setRuntimeArguments={setRuntimeArguments}
                            actionBtnClassName={classes.actionButton}
                        />
                    )}
                    <ActionsContainer
                        configName={params.user_config}
                        featureName={params.user_feature}
                        isServerActive={isNodeEnvRunning}
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        onToggleChange={onServerEnvironmentStatusChange}
                        displayServerToggle={hasNodeEnvironments}
                        actionBtnClassName={classes.actionButton}
                    />
                    <DependencyGraph fetchGraphData={fetchGraphData} />
                </div>
            </div>
        </DashboardContext.Provider>
    );
});

Dashboard.displayName = 'Dashboard';
