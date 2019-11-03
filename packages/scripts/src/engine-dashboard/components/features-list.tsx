/* eslint-disable react/display-name */

import React, { useEffect, useState } from 'react';
import ReactTable, { Column, DefaultFilterFunction } from 'react-table';
import 'react-table/react-table.css';
import { isServerResponseMessage, ServerResponse, ServerState } from '../../server-types';
import { ServerEnvironmentButton } from './button';

const fetchServerState = async () => (await fetch('/engine-state')).json();

export const FeaturesList: React.FunctionComponent = () => {
    const [serverState, setServerState] = useState<ServerState>({
        featuresWithRunningNodeEnvs: [],
        features: {}
    });

    const onServerEnvironmentStatusChange = async (serverResponse: ServerResponse) => {
        if (isServerResponseMessage(serverResponse)) {
            const serverStateResponse = await fetchServerState();
            setServerState(serverStateResponse.data);
        } else {
            console.error(serverResponse);
        }
    };

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const serverResponse = await fetchServerState();
            setServerState(serverResponse.data);
        };

        possibleFeaturesRequest().catch(error => {
            console.error(error);
        });
    }, []);

    const data: Array<{
        featureName: string;
        configName: string;
        url: string;
        runningNodeEnvironment: boolean;
        hasServerEnvironments: boolean;
    }> = [];
    for (const [featureName, { configurations, hasServerEnvironments }] of Object.entries(serverState.features)) {
        for (const configName of configurations) {
            data.push({
                featureName,
                configName,
                hasServerEnvironments,
                url: `${location.href}main.html?feature=${featureName}&config=${configName}`,
                runningNodeEnvironment: serverState.featuresWithRunningNodeEnvs.includes(featureName)
            });
        }
    }

    const filterFunction: DefaultFilterFunction = (filter, row) => {
        return (row as Record<string, string>)[filter.id].includes(filter.value);
    };

    const columns: Column[] = [
        {
            Header: 'Feature Name',
            accessor: 'featureName',
            filterable: true,
            filterMethod: filterFunction
        },
        {
            Header: 'Config Name',
            accessor: 'configName',
            filterable: true,
            filterMethod: filterFunction
        },
        {
            Header: 'Start/Close node environment',
            accessor: d => d,
            id: 'server-env',
            Cell: props => (
                props.value.hasServerEnvironments ? <ServerEnvironmentButton
                    isNodeEnvActive={props.value.runningNodeEnvironment}
                    configName={props.value.configName}
                    featureName={props.value.featureName}
                    onClick={onServerEnvironmentStatusChange}
                /> : ''
            )
        },
        {
            Header: 'Go to feature',
            accessor: 'url',
            Cell: props => (
                <a href={props.value} target="_blank" rel="noopener noreferrer">
                    Go to page
                </a>
            )
        }
    ];

    return <ReactTable columns={columns} data={data} />;
};
