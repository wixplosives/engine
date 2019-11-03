import React, { useEffect, useState } from 'react';
import { FeaturesSelection } from './features-selection';
import { ServerState, ServerResponse, isServerResponseMessage } from '../../server-types';
import { RuntimeOption } from './runtime-option';
import { classes } from './styles.st.css';

const fetchServerState = async () => (await fetch('/engine-state')).json();

export const Dashboard: React.FC = () => {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {}
    });

    const [selectedFeature, setSelectedFeature] = useState<{
        featureName?: string;
        configName?: string;
        runtimeArguments?: string;
    }>({});

    const [runtimeArguments, setRuntimeArguments] = useState<Array<{ key: string; value: string }>>([]);

    const onServerEnvironmentStatusChange = async (serverResponse: ServerResponse) => {
        if (isServerResponseMessage(serverResponse)) {
            const serverStateResponse = await fetchServerState();
            setServerState(serverStateResponse.data);
        } else {
            console.error(serverResponse);
        }
    };

    const runtimeElements = runtimeArguments.map((_, index) => (
        <RuntimeOption index={index} runtimeArguments={runtimeArguments} onChange={setRuntimeArguments}></RuntimeOption>
    ));

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const serverResponse = await fetchServerState();
            setServerState(serverResponse.data);
        };

        possibleFeaturesRequest().catch(error => {
            console.error(error);
        });
    }, []);

    const currentFeature = selectedFeature.featureName
        ? Object.entries(serverState.features).find(([featureName]) => featureName === selectedFeature.featureName)
        : undefined;
    if (currentFeature) {
        currentFeature
    }

    return (
        <div className={classes['dashboard-container']}>
            <FeaturesSelection
                features={serverState.features}
                onSelected={(featureName, configName) =>
                    setSelectedFeature({ ...selectedFeature, featureName, configName })
                }
            />
            <button
                onClick={() => {
                    setRuntimeArguments([...runtimeArguments, { key: '', value: '' }]);
                }}
            >
                + Add input
            </button>
            <div className={classes['runtime-elements-container']}>{runtimeElements}</div>
            {}
        </div>
    );
};
