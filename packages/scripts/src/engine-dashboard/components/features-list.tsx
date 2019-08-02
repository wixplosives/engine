import React, { useState, useEffect } from 'react';
import ReactTable, { Column } from 'react-table';
import 'react-table/react-table.css';
import { ServerEnvironmentButton } from './button';
import { isSuccessResponse, ServerResponse } from '../../server-types';

const fetchAllPossibleFeatures = async () => (await fetch('possible-entities')).json();

const isPossibleFeaturesAndConfigs = (value: unknown): value is PossibleFeaturesAndConfigs =>
    value && typeof value === 'object' && (value as Record<string, any>).features;

export type PossibleFeaturesAndConfigs = {
    features: string[];
    configs: string[];
};

export const FeaturesList: React.FunctionComponent = () => {
    // const possibleFeatures: {
    //     features: string[];
    //     configs: string[];
    // } = { features: [], configs: [] };

    const onServerEnvironmentStatusChange = (serverResponse: ServerResponse) => {
        if (isSuccessResponse(serverResponse)) {
            alert('started environment');
        } else {
            console.error(serverResponse);
        }
    };

    const [featuresConfigsList, setFeaturesConfigsList] = useState<PossibleFeaturesAndConfigs>({
        features: [],
        configs: []
    });

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const currentReadyFeaturesAndConfigs = await fetchAllPossibleFeatures();
            // const currentRunningNodeEnvironments = await fetchAllPossibleFeatures();
            if (isPossibleFeaturesAndConfigs(currentReadyFeaturesAndConfigs)) {
                setFeaturesConfigsList(currentReadyFeaturesAndConfigs);
            }
        };
        possibleFeaturesRequest();
    }, []);

    const data: Array<{ featureName: string; configName: string; url: string }> = [];
    for (const featureName of featuresConfigsList.features) {
        for (const configName of featuresConfigsList.configs) {
            data.push({
                configName,
                featureName,
                url: `${location.href}main.html?feature=${featureName}&config=${configName}`
            });
        }
    }

    const columns: Column[] = [
        {
            Header: 'Feature Name',
            accessor: 'featureName'
        },
        {
            Header: 'Config Name',
            accessor: 'configName'
        },
        {
            Header: 'Go to feature',
            accessor: 'url',
            Cell: props => <a href={props.value}>Go to page</a>
        },
        {
            Header: 'Start/Close node environment',
            accessor: data => data,
            id: 'server-env',
            Cell: props => (
                <ServerEnvironmentButton
                    isServerActive={false}
                    configName={props.value.configName}
                    featureName={props.value.featureName}
                    onClick={onServerEnvironmentStatusChange}
                />
            )
        }
    ];

    return <ReactTable columns={columns} data={data} />;
};
