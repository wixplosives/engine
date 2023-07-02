import React, { FC, useContext } from 'react';
import { DashboardContext } from '../dashboard';
import { style, classes } from '../dashboard.st.css';

export const Sidebar: FC = () => {
    const { serverState, params, setParams } = useContext(DashboardContext);

    return (
        <section className={classes.leftBar}>
            {!!serverState.featuresWithRunningNodeEnvs.length && (
                <div>
                    <div className={classes.title}>Running Features:</div>
                    {serverState.featuresWithRunningNodeEnvs.map(([f, c]) => (
                        <button
                            className={style(classes.runningFeature, {
                                selected: f === params.user_feature && c === params.user_config,
                            })}
                            key={f + '_' + c}
                            onClick={() => {
                                setParams({
                                    user_config: c,
                                    user_feature: f,
                                });
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
