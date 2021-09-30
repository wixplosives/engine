import React, { useMemo, useCallback } from 'react';
import type { ServerFeatureDef } from '../server-types';
import { classes } from './feature-selection.st.css';
import { TitledElement } from './titled-element';

export interface FeaturesSelectionProps {
    features: Record<string, ServerFeatureDef>;
    selectedFeature?: string;
    selectedConfig?: string;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

export const FeaturesSelection = React.memo<FeaturesSelectionProps>(
    ({ features, onSelected, selectedConfig, selectedFeature }) => {
        const featureNames = useMemo(() => Object.keys(features), [features]);
        const configNames = useMemo(
            () => features[selectedFeature!]?.configurations ?? [],
            [features, selectedFeature]
        );
        const onFeatureChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newFeatureName } = currentTarget;
                const newConfigName = features[newFeatureName]?.configurations[0];
                onSelected?.(newFeatureName, newConfigName);
            },
            [features, onSelected]
        );

        const onConfigChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newConfigName } = currentTarget;
                onSelected?.(selectedFeature, newConfigName);
            },
            [onSelected, selectedFeature]
        );

        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <select value={selectedFeature} onChange={onFeatureChange} disabled={!featureNames.length}>
                        {featureNames.map((featureName) => (
                            <option key={`feature-${featureName}`} value={featureName}>
                                {featureName}
                            </option>
                        ))}
                    </select>
                </TitledElement>
                <TitledElement title={'Config'} className={classes.option}>
                    <select value={selectedConfig} onChange={onConfigChange} disabled={!configNames.length}>
                        {configNames.map((configName) => (
                            <option key={`config-${configName}`} value={configName}>
                                {configName}
                            </option>
                        ))}
                    </select>
                </TitledElement>
            </div>
        );
    }
);

FeaturesSelection.displayName = 'FeaturesSelection';
