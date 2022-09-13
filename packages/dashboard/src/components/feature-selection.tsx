import React, { useMemo, useCallback, useState, useContext, useEffect } from 'react';
import { SelectCtx, ServerStateCtx } from './dashboard-ctx';
import { classes } from './feature-selection.st.css';
import { TitledElement } from './titled-element';

const useHandler = <T extends Function>(setter: T): React.ChangeEventHandler<any> => useCallback(
    ({ currentTarget: { value } }) => {
        setter(value)
    },
    [setter]
)

export const FeaturesSelection = React.memo<{}>(
    () => {
        const [{ features }] = useContext(ServerStateCtx)
        const [selected, setSelected] = useContext(SelectCtx)
        const featureNames = useMemo(() => Object.keys(features), [features]);
        const [feature, setFeature] = useState((selected.feature || ''))
        const [fixture, setFixture] = useState(selected.fixture || '')
        const [config, setConfig] = useState(selected.config || '')
        
        useEffect(() => {
            const name = fixture || feature;
            if (features[name]) {
                setSelected({
                    feature, fixture, config
                })
            } else {
                setFixture('')
                setConfig('')
            }
        }, [feature, fixture, config, features])
        const stripFeature = (name: string) => name.replace(`${feature}/`, '')

        return (
            <div className={classes.root}>
                <TitledElement title={'Feature'} className={classes.option}>
                    <input
                        list="features"
                        value={feature}
                        // defaultValue={featureNames[0]}
                        disabled={!featureNames.length}
                        onChange={useHandler(setFeature)}
                        onFocus={() => setFeature('')}
                        autoComplete="false"
                    />
                    <datalist id="features"> {
                        featureNames.filter(i => !i.includes("/")).sort().map((featureName) => (
                            <option key={`feature-${featureName}`} value={featureName}>
                                {featureName}
                            </option>
                        ))}
                    </datalist>
                    <input type="checkbox" id="onlyFixture"
                        checked={false}
                        onChange={() => { }}
                    />
                    <label>Must have fixtures</label>

                </TitledElement>
                <TitledElement title='Fixture' className={classes.option}>
                    <select onChange={useHandler(setFixture)} defaultValue={selected.fixture}>
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
                    <select onChange={useHandler(setConfig)} defaultValue={selected.config} >
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
