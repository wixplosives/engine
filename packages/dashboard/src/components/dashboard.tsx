import React, { useCallback, useEffect, useState } from 'react';
import type { SerializedGraphData } from '../server/common';
import { isServerResponseMessage, ServerState } from '../server-types';
import { useLocalStorage } from '../use-local-storage';
import { ActionsContainer } from './actions-container';
import { CtxProvider, defaultEnvRuntimeOptions, defaultFeaturesGraph, defaultSelection, defaultServerState, EnvRuntimeOptions } from './dashboard-ctx';
import { classes } from './dashboard.st.css';
import { DependencyGraph } from './dependency-graph/dependency-graph';
import { FeaturesSelection } from './feature-selection';
import { Sidebar } from './sidebar/sidebar';

export interface IDashboardProps {
    fetchServerState: () => Promise<ServerState>;
    changeNodeEnvironmentState: (
        featureName: string,
        configName: string,
        isNodeEnvActive: boolean,
        runtimeOptions: EnvRuntimeOptions
    ) => Promise<unknown>;
    fetchGraphData: () => Promise<SerializedGraphData>;
}

export const Dashboard = React.memo<IDashboardProps>(function Dashboard({
    fetchServerState,
    changeNodeEnvironmentState,
    fetchGraphData,
}) {
    const [serverState, setServerState] = useState(defaultServerState);
    const [selected, setSelected] = useLocalStorage('selection', defaultSelection)
    const [featuresGraph, setFeaturesGraph] = useState(defaultFeaturesGraph)
    const [envRuntimeOptions, setEnvRuntimeOptions] = useLocalStorage('runtime', defaultEnvRuntimeOptions);

    const onServerEnvironmentStatusChange = useCallback(
        async (isNodeEnvActive: boolean) => {
            const serverResponse = await changeNodeEnvironmentState(
                selected.fixture,
                selected.config,
                !isNodeEnvActive,
                envRuntimeOptions
            );
            if (isServerResponseMessage(serverResponse)) {
                const serverStateResponse = await fetchServerState();
                setServerState(serverStateResponse);
            } else {
                console.error(serverResponse);
            }
        },
        [
            changeNodeEnvironmentState,
            selected.fixture,
            selected.config,
            envRuntimeOptions,
            fetchServerState,
        ]
    );

    useEffect(() => {
        fetchServerState().then(setServerState).catch(console.error)
        fetchGraphData().then(setFeaturesGraph).catch(console.error)
    }, [fetchServerState, fetchGraphData]);

    const isNodeEnvRunning = !!serverState.featuresWithRunningNodeEnvs.find(
        ([featureName, configName]) =>
            selected.fixture === featureName &&
            ((!selected.fixture && !configName) || (configName && selected.config === configName))
    );

    serverState.featuresWithRunningNodeEnvs;
    console.log(featuresGraph)

    return (
        <CtxProvider
            selection={[selected, setSelected] }
            features={[featuresGraph, setFeaturesGraph]}
            envRuntimeOptions={[envRuntimeOptions, setEnvRuntimeOptions] }
            serverState={[serverState, setServerState] }>
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
                        displayServerToggle={true}
                        actionBtnClassName={classes.actionButton}
                    />
                    <DependencyGraph />
                </div>
            </div>
        </CtxProvider>
    );
});

Dashboard.displayName = 'Dashboard';
