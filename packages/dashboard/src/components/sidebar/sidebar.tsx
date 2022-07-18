import React, { FC, useContext } from 'react';
import { DashboardContext } from '../dashboard';
import { style, classes } from '../dashboard.st.css';

const Sidebar: FC = () => {
    const dashboardContext = useContext(DashboardContext);

    return (
        <section className={classes.leftBar}>
            {dashboardContext.serverState.featuresWithRunningNodeEnvs.length && (
                <div>
                    <div className={classes.title}>Running Features:</div>
                    {dashboardContext.serverState.featuresWithRunningNodeEnvs.map(([f, c]) => (
                        <button
                            className={style(classes.runningFeature, {
                                selected:
                                    f === dashboardContext.params.user_feature &&
                                    c === dashboardContext.params.user_config,
                            })}
                            key={f + '_' + c}
                            onClick={() => {
                                dashboardContext.setParams({
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

export default Sidebar;
