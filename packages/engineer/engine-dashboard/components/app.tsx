import React from 'react';
import { Dashboard } from './dashboard';
import { classes } from './styles.st.css';

const fetchServerState = async () => (await fetch(`engine-state`)).json();

const changeNodeEnvironmentState = async (
    featureName: string,
    configName: string,
    isNodeEnvActive: boolean,
    runtimeOptions: Array<{ key: string; value: string }> = []
) =>
    await (
        await fetch(`engine-feature`, {
            method: isNodeEnvActive ? 'POST' : 'PUT',
            body: JSON.stringify({
                featureName,
                configName,
                runtimeOptions: runtimeOptions.reduce((acc, curr) => {
                    acc[curr.key] = curr.value;
                    return acc;
                }, {} as Record<string, string>),
            }),
            headers: {
                'Content-type': 'application/json',
            },
        })
    ).json();

export const App: React.FC = () => {
    return (
        <div className={classes.root}>
            <Dashboard
                fetchServerState={fetchServerState}
                changeNodeEnvironmentState={changeNodeEnvironmentState}
            ></Dashboard>
        </div>
    );
};
