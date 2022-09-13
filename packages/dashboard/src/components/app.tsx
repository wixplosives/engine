import React from 'react';
import { Dashboard } from './dashboard';
import { classes } from './app.st.css';
import './reset.st.css';
import { changeNodeEnvironmentState, fetchGraphData, fetchServerState } from '../server/communication';

export const App = () => {
    return (
        <div className={classes.root}>
            <Dashboard {...{fetchServerState, changeNodeEnvironmentState, fetchGraphData}}></Dashboard>
        </div>
    );
};
