import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SerializedGraphData } from '../graph-types';
import { isServerResponseMessage, ServerState } from '../server-types';
import { ActionsContainer } from './actions-container';
import { DashboardCtx, defaultDashboardCtx, defaultSelection } from './dashboard-ctx';
import { useUrlParams } from './dashboard-hooks';
import { classes } from './dashboard.st.css';
import { DependencyGraph } from './dependency-graph/dependency-graph';
import { FeaturesSelection } from './feature-selection';
import type { IRuntimeOption, RuntimeOptionsContainer } from './runtime-options-container';
import { Sidebar } from './sidebar/sidebar';

export interface IDashboardProps {
    fetchServerState: () => Promise<{
        result: 'success' | 'error';
        data: ServerState;
    }>;
    changeNodeEnvironmentState: (
        featureName: string,
        configName: string,
        isNodeEnvActive: boolean,
        runtimeOptions: Array<IRuntimeOption>
    ) => Promise<unknown>;
    fetchGraphData: (featureName: string) => Promise<SerializedGraphData>;
}

export const Dashboard = React.memo<IDashboardProps>(function Dashboard({
    fetchServerState,
    changeNodeEnvironmentState,
    fetchGraphData,
}) {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {},
    });
    const [selected, setSelected] = useState({
        ...defaultSelection
    })
    const [featuresGraph, setFeaturesGraph] = useState<SerializedGraphData>({
        nodes:[],
        links: []
    })

    const [runtimeArguments, setRuntimeArguments] = useState<Array<IRuntimeOption>>([
        {
            key: '',
            value: '',
        },
    ]);

    const onServerEnvironmentStatusChange = useCallback(
        async (isNodeEnvActive: boolean) => {
            const serverResponse = await changeNodeEnvironmentState(
                selected.fixture,
                selected.config,
                !isNodeEnvActive,
                runtimeArguments
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
            selected.fixture,
            selected.config,
            runtimeArguments,
            fetchServerState,
        ]
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

   
    const addRuntimeOption = useCallback(
        () => setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]),
        [runtimeArguments, setRuntimeArguments]
    );

    const isNodeEnvRunning = !!serverState.featuresWithRunningNodeEnvs.find(
        ([featureName, configName]) =>
            selected.fixture === featureName &&
            ((!selected.fixture && !configName) || (configName && selected.config === configName))
    );

    serverState.featuresWithRunningNodeEnvs;

    return (
        <DashboardCtx.Provider
            value={{
                serverState,
                selected,
                setSelected,
                featuresGraph
            }}
        >
            <div className={classes.root}>
                <Sidebar />
                <div className={classes.content}>
                    <FeaturesSelection />
                    {/* {hasNodeEnvironments && (
                        <RuntimeOptionsContainer
                            onOptionAdded={addRuntimeOption}
                            runtimeOptions={runtimeArguments}
                            setRuntimeArguments={setRuntimeArguments}
                            actionBtnClassName={classes.actionButton}
                        />
                    )} */}
                    <ActionsContainer
                        configName={selected.config}
                        featureName={selected.fixture}
                        isServerActive={isNodeEnvRunning}
                        // eslint-disable-next-line @typescript-eslint/no-misused-promises
                        onToggleChange={onServerEnvironmentStatusChange}
                        displayServerToggle={hasNodeEnvironments}
                        actionBtnClassName={classes.actionButton}
                    />
                    <DependencyGraph fetchGraphData={fetchGraphData} />
                </div>
            </div>
        </DashboardCtx.Provider>
    );
});

Dashboard.displayName = 'Dashboard';
