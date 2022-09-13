import React, { FC, useContext } from 'react';
import { SelectCtx, ServerStateCtx } from '../dashboard-ctx';
import { style, classes } from '../dashboard.st.css';

export const Sidebar: FC = () => {
    const [ selected ] = useContext(SelectCtx);
    const [ serverState ] = useContext(ServerStateCtx);

    return (
        <section className={classes.leftBar}>
            {serverState.featuresWithRunningNodeEnvs.length && (
                <div>
                    <div className={classes.title}>Running Features:</div>
                    {serverState.featuresWithRunningNodeEnvs.map(([f, c]) => (
                        <button
                            className={style(classes.runningFeature, {
                                selected: f === selected.fixture && c === selected.config,
                            })}
                            key={f + '_' + c}
                            onClick={() => {
                               
                            }}
                        >
                            <div>Feature: {f}</div>
                            <div> config: {c}</div>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
};
