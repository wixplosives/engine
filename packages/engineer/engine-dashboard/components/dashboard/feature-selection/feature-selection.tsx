import React, { useState, useMemo, useCallback, memo } from 'react';
import Select from 'react-select';
import type { ServerFeatureDef } from '../../../../server-types';
import { classes } from './feature-selection.st.css';
import { TitledElement } from '../titled-element';

type SelectedValue<T> =
    | {
          label?: string;
          value?: T;
      }
    | readonly {
          label?: string;
          value?: T;
      }[]
    | null;

interface IFeatureSelectionProps {
    features: Record<string, ServerFeatureDef>;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

export const FeaturesSelection = memo<IFeatureSelectionProps>(({ features, onSelected }) => {
    const [selectedFeatureConfigurations, setSelectedFeatureConfigurations] = useState<string[]>([]);
    const [selectedFeatureName, setSelectedFeatureName] = useState<string>('');
    const [selectedConfigName, setSelectedConfigName] = useState<string>();

    const featuresOptions = useMemo(
        () =>
            Object.entries(features).map(([featureName, featureDef]) => ({
                label: featureName,
                value: featureDef,
            })),
        [features]
    );

    const onFeatureSelectedChange = (selectedValue?: SelectedValue<ServerFeatureDef>) => {
        if (!selectedValue) {
            setSelectedFeatureConfigurations([]);
            if (onSelected) {
                setSelectedConfigName(undefined);
                onSelected(undefined, undefined);
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

    const selectedConfigurationsOptions = useMemo(
        () =>
            selectedFeatureConfigurations.map((config) => ({
                value: config,
                label: config,
            })),
        [selectedFeatureConfigurations]
    );

    const onConfigurationSelect = useCallback(
        (selectedValue?: SelectedValue<string>) => {
            const configName = !selectedValue
                ? selectedValue
                : (Array.isArray(selectedValue) ? selectedValue[0] : selectedValue).label;

            setSelectedConfigName(configName === null ? undefined : configName);
            if (onSelected) {
                onSelected(selectedFeatureName, configName);
            }
        },
        [setSelectedConfigName, onSelected, selectedFeatureName]
    );

    return (
        <div className={classes.root}>
            <TitledElement title={'Feature'} className={classes.option}>
                <Select
                    isSearchable={true}
                    options={featuresOptions}
                    onChange={(selectedValue) => onFeatureSelectedChange(selectedValue)}
                    isMulti={false}
                    isClearable={true}
                />
            </TitledElement>
            <TitledElement title={'Config'} className={classes.option}>
                <Select
                    isSearchable={true}
                    isMulti={false}
                    isClearable={true}
                    options={selectedConfigurationsOptions}
                    isDisabled={selectedFeatureConfigurations.length === 0}
                    onChange={(selectedValue) => onConfigurationSelect(selectedValue)}
                    value={{
                        label: selectedConfigName,
                        value: selectedConfigName,
                    }}
                />
            </TitledElement>
        </div>
    );
});

FeaturesSelection.displayName = 'FeaturesSelection';
