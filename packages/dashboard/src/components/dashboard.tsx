import React, { useEffect, useState, useCallback } from 'react';
import { FeaturesSelection } from './feature-selection';
import { ServerState, isServerResponseMessage } from '../server-types';
import type { GraphData } from '../graph-types';
import { classes } from './dashboard.st.css';
import { RuntimeOptionsContainer, IRuntimeOption } from './runtime-options-container';
import { ActionsContainer } from './actions-container';
import { FeatureGraph } from './feature-graph';

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

    const [showGraph, setShowGraph] = useState(false);
    const [selectedFeature, setSelectedFeature] = useState<SelectedFeature>({});
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
                selectedFeature.featureName!,
                selectedFeature.configName!,
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
        [fetchServerState, selectedFeature, runtimeArguments, changeNodeEnvironmentState]
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
            setSelectedFeature({ ...selectedFeature, featureName, configName });
            if (featureName) {
                const graphData = await fetchGraphData(featureName);
                setSelectedFeatureGraph(graphData);
            }
        },
        [setSelectedFeature, selectedFeature, fetchGraphData]
    );

    const hasNodeEnvironments =
        !!selectedFeature.featureName && !!serverState.features[selectedFeature.featureName]?.hasServerEnvironments;

    const addRuntimeOption = useCallback(
        () => setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]),
        [runtimeArguments, setRuntimeArguments]
    );

    const isNodeEnvRunning = !!serverState.featuresWithRunningNodeEnvs.find(
        ([featureName, configName]) =>
            selectedFeature.featureName === featureName &&
            ((!selectedFeature.configName && !configName) || (configName && selectedFeature.configName === configName))
    );

    return (
        <div className={classes.root}>
            <FeaturesSelection features={serverState.features} onSelected={selectedFeatureConfig} />
            {hasNodeEnvironments ? (
                <RuntimeOptionsContainer
                    onOptionAdded={addRuntimeOption}
                    runtimeOptions={runtimeArguments}
                    setRuntimeArguments={setRuntimeArguments}
                    actionBtnClassName={classes.actionButton}
                />
            ) : null}
            <ActionsContainer
                configName={selectedFeature.configName}
                featureName={selectedFeature.featureName}
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
                selectedFeature?.featureName ? (
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
    );
});

Dashboard.displayName = 'Dashboard';
