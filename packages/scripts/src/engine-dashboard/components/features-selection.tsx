import React, { useState } from 'react';
import Select from 'react-select';
import { ServerFeatureDef } from '../../server-types';
import { classes } from './styles.st.css';

const fetchServerState = {
    features: {
        'file-server': {
            configurations: ['file-server/run'],
            hasServerEnvironments: true,
            featureName: 'file-server'
        },
        'file-server/example': {
            configurations: ['file-server/run'],
            hasServerEnvironments: true,
            featureName: 'file-server/example'
        },
        'multi-env': { configurations: ['multi-env/run'], hasServerEnvironments: false, featureName: 'multi-env' },
        'multi-env/test-node': {
            configurations: ['multi-env/run'],
            hasServerEnvironments: true,
            featureName: 'multi-env/test-node'
        },
        'multi-env/test-worker': {
            configurations: ['multi-env/run'],
            hasServerEnvironments: false,
            featureName: 'multi-env/test-worker'
        },
        playground: { configurations: ['playground/run'], hasServerEnvironments: false, featureName: 'playground' },
        'reloaded-iframe': { configurations: [], hasServerEnvironments: false, featureName: 'reloaded-iframe' },
        'engine-core/communication': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'engine-core/communication'
        },
        '3rd-party': { configurations: [], hasServerEnvironments: false, featureName: '3rd-party' },
        'contextual/some-feature': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'contextual/some-feature'
        },
        'contextual/server-env': {
            configurations: [],
            hasServerEnvironments: true,
            featureName: 'contextual/server-env'
        },
        'engine-single/x': {
            configurations: ['engine-single/x'],
            hasServerEnvironments: false,
            featureName: 'engine-single/x'
        },
        'engine-multi/app': {
            configurations: ['engine-multi/fixture1', 'engine-multi/variant1', 'engine-multi/variant2'],
            hasServerEnvironments: false,
            featureName: 'engine-multi/app'
        },
        'engine-multi/variant': {
            configurations: ['engine-multi/fixture1', 'engine-multi/variant1', 'engine-multi/variant2'],
            hasServerEnvironments: false,
            featureName: 'engine-multi/variant'
        },
        'engine-node/x': { configurations: [], hasServerEnvironments: true, featureName: 'engine-node/x' },
        'configs/use-configs': {
            configurations: [],
            hasServerEnvironments: false,
            featureName: 'configs/use-configs'
        }
    }
};

type SelectedValue<T> =
    | {
          label: string;
          value: T;
      }
    | readonly {
          label: string;
          value: T;
      }[]
    | null;

interface IFeatureSelectionProps {
    features: Record<string, ServerFeatureDef>;
    onSelected?: (featureName: string, configName: string) => unknown;
}

export const FeaturesSelection: React.FC<IFeatureSelectionProps> = ({
    features = fetchServerState.features,
    onSelected
}) => {
    const [selectedFeatureConfigurations, setSelectedFeatureConfigurations] = useState<string[]>([]);
    const [selectedFeatureName, setSelectedFeatureName] = useState<string>('');

    // const onServerEnvironmentStatusChange = async (serverResponse: ServerResponse) => {
    //     if (isServerResponseMessage(serverResponse)) {
    //         const serverStateResponse = await fetchServerState();
    //         setServerState(serverStateResponse.data);
    //     } else {
    //         console.error(serverResponse);
    //     }
    // };

    // useEffect(() => {
    //     const possibleFeaturesRequest = async () => {
    //         const serverResponse = await fetchServerState();
    //         setServerState(serverResponse.data);
    //     };

    //     possibleFeaturesRequest().catch(error => {
    //         console.error(error);
    //     });
    // }, []);

    const featuresOptions = Object.entries(features).map(([featureName, featureDef]) => ({
        label: featureName,
        value: featureDef
    }));

    const onFeatureSelectedChange = (selectedValue?: SelectedValue<ServerFeatureDef>) => {
        if (!selectedValue) {
            setSelectedFeatureConfigurations([]);
        } else {
            const featureValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
            setSelectedFeatureName(featureValue.label);
            setSelectedFeatureConfigurations(featureValue.value.configurations);
        }
    };

    const selectedConfigurationsOptions = selectedFeatureConfigurations.map(config => ({
        value: config,
        label: config
    }));

    const onConfigurationSelect = (selectedValue?: SelectedValue<string>) => {
        if (selectedValue) {
            const configValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
            if (onSelected) {
                onSelected(selectedFeatureName, configValue.label);
            }
        }
    };

    return (
        <div className={classes.options}>
            <Select
                isSearchable={true}
                options={featuresOptions}
                onChange={selectedValue => onFeatureSelectedChange(selectedValue)}
                isMulti={false}
                isClearable={true}
            />
            <Select
                isSearchable={true}
                isMulti={false}
                isClearable={true}
                options={selectedConfigurationsOptions}
                isDisabled={selectedFeatureConfigurations.length === 0}
                onChange={selectedValue => onConfigurationSelect(selectedValue)}
            />
        </div>
    );
};
