import React, { useState, useMemo, useCallback, memo } from 'react';
import type { ServerFeatureDef } from '../../../server-types';
import { classes } from './feature-selection.st.css';
import { TitledElement } from '../titled-element';

export interface FeaturesSelectionProps {
    features: Record<string, ServerFeatureDef>;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

export const FeaturesSelection = memo<FeaturesSelectionProps>(({ features, onSelected }) => {
    const featureNames = useMemo(() => Object.keys(features), [features]);
    const [firstFeatureName] = featureNames;
    const [selectedFeatureName, setSelectedFeatureName] = useState<string | undefined>(firstFeatureName);
    const configNames = useMemo(() => features[selectedFeatureName!]?.configurations ?? [], [
        features,
        selectedFeatureName,
    ]);
    const [firstConfigName] = configNames;
    const [selectedConfigName, setSelectedConfigName] = useState<string>(firstConfigName);

    const onFeatureChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
        ({ currentTarget }) => {
            const { value: newFeatureName } = currentTarget;
            const newConfigName = features[newFeatureName]?.configurations[0];
            setSelectedFeatureName(newFeatureName);
            setSelectedConfigName(newConfigName);
            onSelected?.(newFeatureName, newConfigName);
        },
        [features, onSelected]
    );

    const onConfigChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
        ({ currentTarget }) => {
            const { value: newConfigName } = currentTarget;
            setSelectedConfigName(newConfigName);
            onSelected?.(selectedFeatureName, newConfigName);
        },
        [onSelected, selectedFeatureName]
    );

    return (
        <div className={classes.root}>
            <TitledElement title={'Feature'} className={classes.option}>
                <select value={selectedFeatureName} onChange={onFeatureChange} disabled={!featureNames.length}>
                    {featureNames.map((featureName) => (
                        <option key={`feature-${featureName}`} value={featureName}>
                            {featureName}
                        </option>
                    ))}
                </select>
            </TitledElement>
            <TitledElement title={'Config'} className={classes.option}>
                <select value={selectedConfigName} onChange={onConfigChange} disabled={!configNames.length}>
                    {configNames.map((configName) => (
                        <option key={`config-${configName}`} value={configName}>
                            {configName}
                        </option>
                    ))}
                </select>
            </TitledElement>
        </div>
    );
});

FeaturesSelection.displayName = 'FeaturesSelection';
