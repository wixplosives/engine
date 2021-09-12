import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FeaturesSelection } from './feature-selection';
import { ServerState, isServerResponseMessage } from '../server-types';
import type { GraphData } from '../graph-types';
import { style, classes } from './dashboard.st.css'; 
import { RuntimeOptionsContainer, IRuntimeOption } from './runtime-options-container';
import { ActionsContainer } from './actions-container';
import { FeatureGraph } from './feature-graph';
import { useUrlParams } from './dashboard-hooks';
 
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
    fetchGraphData: (featureName: string) => Promise<GraphData>;
}

export interface SelectedFeature {
    featureName?: string;
    configName?: string;
    runtimeArguments?: string;
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
    const [firstFeatureName] = Object.keys(serverState.features);
    const [params, setParams] = useUrlParams({
        user_feature: firstFeatureName,
        user_config: undefined,
    });

    const configNames = useMemo(
        () => serverState.features[params.user_feature || '']?.configurations ?? [],
        [params.user_feature, serverState.features]
    );
    const [firstConfigName] = configNames;
    const [showGraph, setShowGraph] = useState(false);

    const [selectedFeatureGraph, setSelectedFeatureGraph] = useState<GraphData | null>(null);

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
            params.user_feature,
            params.user_config,
            firstConfigName,
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

    const selectedFeatureConfig = useCallback(
        async (featureName?: string, configName?: string) => {
            setSelectedFeatureGraph(null);
            if (!featureName) {
                setRuntimeArguments([{ key: '', value: '' }]);
            }
            setParams({
                user_config: configName,
                user_feature: featureName,
            });
            if (featureName) {
                const graphData = await fetchGraphData(featureName);
                setSelectedFeatureGraph(graphData);
            }
        },
        [setParams, fetchGraphData]
    );

    const hasNodeEnvironments =
        !!params.user_feature && !!serverState.features[params.user_feature]?.hasServerEnvironments;

    const addRuntimeOption = useCallback(
        () => setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]),
        [runtimeArguments, setRuntimeArguments]
    );

    const isNodeEnvRunning = !!serverState.featuresWithRunningNodeEnvs.find(
        ([featureName, configName]) =>
            params.user_feature === featureName &&
            ((!params.user_feature && !configName) || (configName && params.user_config === configName))
    );
    serverState.featuresWithRunningNodeEnvs;
    return (
        <div className={classes.root}>
            <div className={classes.leftBar}>
                {serverState.featuresWithRunningNodeEnvs.length ? (
                    <div>
                        <div  className={classes.title}>Running Features:</div>
                        {serverState.featuresWithRunningNodeEnvs.map(([f, c]) => (
                            <button
                                className={style(classes.runningFeature, {
                                    selected: f === params.user_feature && c === params.user_config,
                                })}
                                key={f + '_' + c}
                                onClick={() => {
                                    setParams({
                                        user_config: c,
                                        user_feature: f,
                                    });
                                }}
                            >
                                <div>Feature: {f}</div>
                                <div> config: {c}</div>
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className={classes.content}>
                <FeaturesSelection
                    features={serverState.features}
                    onSelected={selectedFeatureConfig}
                    selectedConfig={params.user_config}
                    selectedFeature={params.user_feature}
                />
                {hasNodeEnvironments ? (
                    <RuntimeOptionsContainer
                        onOptionAdded={addRuntimeOption}
                        runtimeOptions={runtimeArguments}
                        setRuntimeArguments={setRuntimeArguments}
                        actionBtnClassName={classes.actionButton}
                    />
                ) : null}
                <ActionsContainer
                    configName={params.user_config}
                    featureName={params.user_feature}
                    isServerActive={isNodeEnvRunning}
                    onToggleChange={onServerEnvironmentStatusChange}
                    displayServerToggle={hasNodeEnvironments}
                    actionBtnClassName={classes.actionButton}
                />
                <div>
                    <input
                        id="feature-graph"
                        type="checkbox"
                        checked={showGraph}
                        onChange={(e) => setShowGraph(e.currentTarget.checked)}
                    />
                    <label htmlFor="feature-graph">Feature Dependency Graph</label>
                </div>
                {showGraph ? (
                    params.user_feature ? (
                        selectedFeatureGraph ? (
                            <FeatureGraph selectedFeatureGraph={selectedFeatureGraph} />
                        ) : (
                            <div>Loading graph data...</div>
                        )
                    ) : (
                        <div>Select a feature to view its dependency graph</div>
                    )
                ) : null}
            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
