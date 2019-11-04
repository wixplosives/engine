import React, { useEffect, useState } from 'react';
import { FeaturesSelection } from './features-selection';
import { ServerState, ServerResponse, isServerResponseMessage } from '../../server-types';
import { RuntimeOption } from './runtime-option';
import { classes } from './styles.st.css';
import { ServerEnvironmentToggle } from './button';

export interface IDashboardProps {
    fetchServerState: () => Promise<{
        result: 'success' | 'error';
        data: ServerState;
    }>;
}

export const Dashboard: React.FC<IDashboardProps> = ({ fetchServerState }) => {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {}
    });

    const [selectedFeature, setSelectedFeature] = useState<{
        featureName?: string;
        configName?: string;
        runtimeArguments?: string;
    }>({});

    const [runtimeArguments, setRuntimeArguments] = useState<Array<{ key: string; value: string }>>([
        {
            key: '',
            value: ''
        }
    ]);

    const onServerEnvironmentStatusChange = async (serverResponse: ServerResponse) => {
        if (isServerResponseMessage(serverResponse)) {
            const serverStateResponse = await fetchServerState();
            setServerState(serverStateResponse.data);
        } else {
            console.error(serverResponse);
        }
    };

    const runtimeElements = runtimeArguments.map((_, index) => (
        <RuntimeOption
            key={index}
            index={index}
            runtimeArguments={runtimeArguments}
            onChange={setRuntimeArguments}
        ></RuntimeOption>
    ));

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const serverResponse = await fetchServerState();
            setServerState(serverResponse.data);
        };

        possibleFeaturesRequest().catch(error => {
            console.error(error);
        });
    }, [fetchServerState]);

    const hasNodeEnvironments =
        selectedFeature.featureName &&
        selectedFeature.configName &&
        serverState.features[selectedFeature.featureName] &&
        serverState.features[selectedFeature.featureName].hasServerEnvironments;

    return (
        <div className={classes.dashboardContainer}>
            <FeaturesSelection
                features={serverState.features}
                onSelected={(featureName, configName) => {
                    if (!featureName) {
                        setRuntimeArguments([{ key: '', value: '' }]);
                    }
                    setSelectedFeature({ ...selectedFeature, featureName, configName });
                }}
            />
            {hasNodeEnvironments ? (
                <div className={classes.runtimeContainer}>
                    <div className={classes.runtimeOptionsTitle}>Runtime options</div>
                    <div className={classes.runtimeElementsContainer}>{runtimeElements}</div>
                    <button
                        className={classes.actionButton}
                        onClick={() => {
                            setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]);
                        }}
                    >
                        +
                    </button>
                </div>
            ) : null}
            <div className={classes.actionsContainer}>
                {hasNodeEnvironments ? (
                    <div className={classes.serverState}>
                        <span>Server status</span>
                        <span>
                            <ServerEnvironmentToggle
                                isNodeEnvActive={
                                    !!serverState.featuresWithRunningNodeEnvs.find(
                                        featureName => selectedFeature.featureName === featureName
                                    )
                                }
                                {...selectedFeature}
                                runtimeOptions={Array.from(runtimeArguments.values())}
                                onClick={onServerEnvironmentStatusChange}
                            />
                        </span>
                    </div>
                ) : null}

                {selectedFeature.featureName && selectedFeature.configName ? (
                    <a
                        href={`/main.html?feature=${selectedFeature.featureName}&config=${selectedFeature.configName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={classes.actionButton}
                    >
                        Go to page
                    </a>
                ) : null}
            </div>
        </div>
    );
};
