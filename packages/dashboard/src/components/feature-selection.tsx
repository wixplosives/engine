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
        const onFeatureChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newFeatureName } = currentTarget;
                const newConfigName = features[newFeatureName]?.configurations[0];
                onSelected?.(newFeatureName, newConfigName);
            },
            [features, onSelected]
        );

        const onConfigChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newConfigName } = currentTarget;
                onSelected?.(selectedFeature, newConfigName);
            },
            [onSelected, selectedFeature]
        );

        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <input
                        list="features"
                        value={selectedFeature}
                        disabled={!featureNames.length}
                        onChange={onFeatureChange}
                    />
                    <datalist id="features">
                        {featureNames.map((featureName) => (
                            <option key={`feature-${featureName}`} value={featureName}>
                                {featureName}
                            </option>
                        ))}
                    </datalist>
                </TitledElement>
                <TitledElement title={'Config'} className={classes.option}>
                    <input
                        list="configs"
                        value={selectedConfig}
                        disabled={!configNames.length}
                        onChange={onConfigChange}
                    />
                    <datalist id="configs">
                        {configNames.map((configName) => (
                            <option key={`config-${configName}`} value={configName}>
                                {configName}
                            </option>
                        ))}
                    </datalist>
                </TitledElement>
            </div>
        );
    }
);

FeaturesSelection.displayName = 'FeaturesSelection';
