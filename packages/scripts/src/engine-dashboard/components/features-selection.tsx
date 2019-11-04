import React, { useState } from 'react';
import Select from 'react-select';
import { ServerFeatureDef } from '../../server-types';
import { classes } from './styles.st.css';
import { TitledElement } from './titled-element';

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
    features,
    onSelected
}) => {
    const [selectedFeatureConfigurations, setSelectedFeatureConfigurations] = useState<string[]>([]);
    const [selectedFeatureName, setSelectedFeatureName] = useState<string>('');
    const [selectedConfigName, setSelectedConfigName] = useState<string>('');

    const featuresOptions = Object.entries(features).map(([featureName, featureDef]) => ({
        label: featureName,
        value: featureDef
    }));

    const onFeatureSelectedChange = (selectedValue?: SelectedValue<ServerFeatureDef>) => {
        if (!selectedValue) {
            setSelectedFeatureConfigurations([]);
            if (onSelected) {
                setSelectedConfigName('');
                onSelected('', '');
            }
        } else {
            const featureValue = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
            setSelectedFeatureName(featureValue.label);
            setSelectedFeatureConfigurations(featureValue.value.configurations);
            if (onSelected) {
                onSelected(featureValue.label, selectedConfigName);
            }
        }
    };

    const selectedConfigurationsOptions = selectedFeatureConfigurations.map(config => ({
        value: config,
        label: config
    }));

    const onConfigurationSelect = (selectedValue?: SelectedValue<string>) => {
        const configName = !selectedValue
            ? ''
            : (Array.isArray(selectedValue) ? selectedValue[0] : selectedValue).label;
        setSelectedConfigName(configName);
        if (onSelected) {
            onSelected(selectedFeatureName, configName);
        }
    };

    return (
        <div className={classes.options}>
            <TitledElement title={'Feature'}>
                <Select
                    isSearchable={true}
                    options={featuresOptions}
                    onChange={selectedValue => onFeatureSelectedChange(selectedValue)}
                    isMulti={false}
                    isClearable={true}
                />
            </TitledElement>
            <TitledElement title={'Config'}>
                <Select
                    isSearchable={true}
                    isMulti={false}
                    isClearable={true}
                    options={selectedConfigurationsOptions}
                    isDisabled={selectedFeatureConfigurations.length === 0}
                    onChange={selectedValue => onConfigurationSelect(selectedValue)}
                    value={{
                        label: selectedConfigName,
                        value: selectedConfigName
                    }}
                />
            </TitledElement>
        </div>
    );
};
