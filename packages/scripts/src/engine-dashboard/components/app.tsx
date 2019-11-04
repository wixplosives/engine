import React from 'react';
import { Dashboard } from './dashboard';
import { classes } from './styles.st.css'

const fetchServerState = async () => (await fetch('/engine-state')).json();

export const App: React.FC = () => {
    return (
        <div className={classes.root}>
            <Dashboard fetchServerState={fetchServerState}></Dashboard>
        </div>
    );
};
