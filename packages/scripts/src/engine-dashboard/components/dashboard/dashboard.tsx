import React, { useEffect, useState, useCallback, memo } from 'react';
import { FeaturesSelection } from './feature-selection';
import { ServerState, isServerResponseMessage } from '../../../server-types';
import { classes } from './dashboard.st.css';
import { RuntimeOptionsContainer, IRuntimeOption } from './runtime-options-container';
import { ActionsContainer } from './actions-container';

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
    ) => Promise<any>;
}

interface SelectedFeature {
    featureName?: string;
    configName?: string;
    runtimeArguments?: string;
}

export const Dashboard = memo<IDashboardProps>(({ fetchServerState, changeNodeEnvironmentState }) => {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {},
    });

    const [selectedFeature, setSelectedFeature] = useState<SelectedFeature>({});

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
        (featureName?: string, configName?: string) => {
            if (!featureName) {
                setRuntimeArguments([{ key: '', value: '' }]);
            }
            setSelectedFeature({ ...selectedFeature, featureName, configName });
        },
        [setSelectedFeature, selectedFeature]
    );

    const hasNodeEnvironments =
        !!selectedFeature.featureName &&
        !!serverState.features[selectedFeature.featureName] &&
        !!serverState.features[selectedFeature.featureName].hasServerEnvironments;

    const addRuntimeOption = useCallback(() => setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]), [
        runtimeArguments,
        setRuntimeArguments,
    ]);

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
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
