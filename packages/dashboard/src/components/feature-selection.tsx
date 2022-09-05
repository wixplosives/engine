import React, { useMemo, useCallback, useState, useContext } from 'react';
import type { ServerFeatureDef } from '../server-types';
import { DashboardContext } from './dashboard';
import { classes } from './feature-selection.st.css';
import { TitledElement } from './titled-element';

export interface FeaturesSelectionProps {
    features: Record<string, ServerFeatureDef>;
    selectedFeature?: string;
    selectedConfig?: string;
    onSelected?: (featureName?: string, configName?: string) => unknown;
}

export const FeaturesSelection = React.memo<{}>(
    () => {
        const { serverState: {features }, selected} = useContext(DashboardContext)
        const featureNames = useMemo(() => Object.keys(features), [features]);
        const [feature, setFeature] = useState((selected.feature || '').replace(/\/.*/, ''))
        const [fixture, setFixtures] = useState(selected.fixture || '')
        const [config, setConfig] = useState(selected.config || '')
        
        const stripFeature =  (name:string) => name.replace(`${feature}/`, '')

        const onSelectionChanged = () => {
            const name = fixture || feature;
            if (features[name]) {
            }
        }

        const onFeatureChange: React.ChangeEventHandler<any> = useCallback(
            ({ currentTarget }) => {
                const { value: newFeatureName } = currentTarget;
                setFeature(newFeatureName)
                onSelectionChanged()
            },
            [onSelectionChanged]
        );

        const onFixtureChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newFeatureName } = currentTarget;
                setConfig(newFeatureName)
                onSelectionChanged()
            },
            [onSelectionChanged]
        );

        const onConfigChange: React.ChangeEventHandler<HTMLSelectElement> = useCallback(
            ({ currentTarget }) => {
                const { value: newFeatureName } = currentTarget;
                setFixtures(newFeatureName)
                onSelectionChanged()
            },
            [onSelectionChanged]
        );

        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <input
                        list="features"
                        value={selectedFeature}
                        disabled={!featureNames.length}
                        onChange={onFeatureChange}
                        autoComplete="false"
                    />
                    <datalist id="features">
                        {
                            featureNames.filter(i => !i.includes("/")).sort().map((featureName) => (
                                <option key={`feature-${featureName}`} value={featureName}>
                                    {featureName}
                                </option>
                            ))}
                    </datalist>
                </TitledElement>
                <TitledElement title='Fixture' className={classes.option}>
                    <select onChange={onFixtureChange} >
                        <option value={feature}>{'<None>'}</option>
                        {
                            featureNames
                                .filter(f => f.startsWith(`${feature}/`))
                                .map(fixtureName => (
                                    <option value={fixtureName} key={`fixture-${fixtureName}`}>
                                        {stripFeature(fixtureName)}
                                    </option>))
                        }
                    </select>
                </TitledElement>
                <TitledElement title={'Config'} className={classes.option}>
                    <select onChange={onConfigChange} >
                        <option>{'<None>'}</option>
                        {
                            features[fixture || feature]
                                ?.configurations
                                .map(confName => (
                                    <option value={confName} key={`conf-${confName}`}>
                                        {stripFeature(confName)}
                                    </option>))
                        }
                    </select>
                </TitledElement>
            </div>
        );
    }
);

FeaturesSelection.displayName = 'FeaturesSelection';
