import React, { useState, useMemo, useCallback, memo } from 'react';
import Select from 'react-select';
import type { ServerFeatureDef } from '../../../server-types';
import { classes } from './feature-selection.st.css';
import { TitledElement } from '../titled-element';

interface SelectionValue<T> {
    label?: string;
    value?: T;
}

type SelectedValue<T> = SelectionValue<T> | readonly SelectionValue<T>[] | null;

interface IFeatureSelectionProps {
    features: Record<string, ServerFeatureDef>;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

export const FeaturesSelection = memo<IFeatureSelectionProps>(({ features, onSelected }) => {
    const [selectedFeatureConfigurations, setSelectedFeatureConfigurations] = useState<string[]>([]);
    const [selectedFeatureName, setSelectedFeatureName] = useState<string | undefined>('');
    const [selectedConfigName, setSelectedConfigName] = useState<string | undefined>();

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
            const featureValue = Array.isArray(selectedValue)
                ? (selectedValue as readonly SelectionValue<ServerFeatureDef>[])[0]
                : (selectedValue as SelectionValue<ServerFeatureDef>);
            setSelectedFeatureName(featureValue.label);
            setSelectedFeatureConfigurations(featureValue.value!.configurations);
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
                : (Array.isArray(selectedValue)
                      ? (selectedValue as readonly SelectionValue<string>[])[0]
                      : (selectedValue as SelectionValue<string>)
                  ).label;

            setSelectedConfigName(configName ?? undefined);
            if (onSelected) {
                onSelected(selectedFeatureName, configName ?? undefined);
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
