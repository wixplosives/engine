import React, { useMemo, useCallback, useState, useContext } from 'react';
import { SelectCtx, ServerStateCtx } from '../dashboard-ctx';
import { classes } from './feature-selection.st.css';
import { TitledElement } from '../titled-element';
import { useOnCtxSelectionChanged, useOnUserSelection } from './effects';

const useHandler = <T extends Function>(setter: T): React.ChangeEventHandler<any> => useCallback(
    ({ currentTarget: { type, value, checked } }) => {
        setter(type === 'checkbox' ? checked : value)
    },
    [setter]
)

export const FeaturesSelection = React.memo(
    () => {
        const [{ features }] = useContext(ServerStateCtx)
        const [selected, setSelected] = useContext(SelectCtx)
        const featureNames = useMemo(() => Object.keys(features), [features]);
        const [feature, setFeature] = useState((selected.feature || ''))
        const [fixture, setFixture] = useState(selected.fixture || '')
        const [config, setConfig] = useState(selected.config || '')
        const [filterFixtures, setFilterFixtures] = useState(false)
        useOnUserSelection(features, feature, fixture, config, setSelected, setFixture, setConfig);
        useOnCtxSelectionChanged(selected, setFeature, setFixture, setConfig);
        const displayFeature = useMemo(() =>
            featureNames
                .filter(i => !i.includes("/") &&
                    (!filterFixtures || featureNames.some(
                        fn => fn.startsWith(`${i}/`)
                    )))
            , [featureNames, filterFixtures]
        )

        const stripFeature = (name: string) => name.replace(`${feature}/`, '')


        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <input
                        list="features"
                        value={feature}
                        disabled={!featureNames.length}
                        onChange={useHandler(setFeature)}
                        onFocus={() => setFeature('')}
                        autoComplete="false"
                    />
                    <datalist id="features"> {
                        displayFeature.sort().map((featureName) => (
                            <option key={`feature-${featureName}`} value={featureName}>
                                {featureName}
                            </option>
                        ))}
                    </datalist>
                </TitledElement>
                <TitledElement title='Fixture' className={classes.option}>
                    <select onChange={useHandler(setFixture)} value={selected.fixture}>
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
                    <input type="checkbox" id="fixtureFilter"
                        checked={filterFixtures}
                        onChange={useHandler(setFilterFixtures)}
                    />
                    <label htmlFor="fixtureFilter">Fixtures filter</label>
                </TitledElement>
                <TitledElement title={'Config'} className={classes.option}>
                    <select onChange={useHandler(setConfig)} value={selected.config} >
                        <option value={''}>{'<None>'}</option>
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
