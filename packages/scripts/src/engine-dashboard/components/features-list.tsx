import React, { useEffect, useState } from 'react';
import ReactTable, { Column, DefaultFilterFunction } from 'react-table';
import 'react-table/react-table.css';
import { isListNodeEnvironmtnrsResponse, isSuccessResponse, ServerResponse } from '../../server-types';
import { ServerEnvironmentButton } from './button';

const fetchAllPossibleFeatures = async () => (await fetch('possible-entities')).json();
const fetchRunningNodeEnvironments = async () => (await fetch('node-env')).json();

const isPossibleFeaturesAndConfigs = (value: unknown): value is PossibleFeaturesAndConfigs =>
    value && typeof value === 'object' && (value as Record<string, any>).features;

export interface PossibleFeaturesAndConfigs {
    features: string[];
    configs: string[];
}

export const FeaturesList: React.FunctionComponent = () => {
    const [featuresConfigsList, setFeaturesConfigsList] = useState<PossibleFeaturesAndConfigs>({
        features: [],
        configs: []
    });

    const [runningNodeEnvironments, setRunningNodeEnvironments] = useState<Record<string, string[]>>({});

    const onServerEnvironmentStatusChange = (
        serverResponse: ServerResponse,
        featureName: string,
        configName: string
    ) => {
        if (isSuccessResponse(serverResponse)) {
            if (!runningNodeEnvironments[featureName]) {
                runningNodeEnvironments[featureName] = [];
            }
            if (runningNodeEnvironments[featureName].includes(configName)) {
                runningNodeEnvironments[featureName].splice(
                    runningNodeEnvironments[featureName].indexOf(configName),
                    1
                );
            } else {
                runningNodeEnvironments[featureName] = [...runningNodeEnvironments[featureName], configName];
            }
            setRunningNodeEnvironments({ ...runningNodeEnvironments });
        } else {
            // tslint:disable-next-line no-console
            console.error(serverResponse);
        }
    };

    useEffect(() => {
        const possibleFeaturesRequest = async () => {
            const currentReadyFeaturesAndConfigs = await fetchAllPossibleFeatures();
            const currentRunningNodeEnvironments = await fetchRunningNodeEnvironments();
            if (isPossibleFeaturesAndConfigs(currentReadyFeaturesAndConfigs)) {
                setFeaturesConfigsList(currentReadyFeaturesAndConfigs);
            }
            if (isListNodeEnvironmtnrsResponse(currentRunningNodeEnvironments)) {
                if (currentRunningNodeEnvironments.data && !Array.isArray(currentRunningNodeEnvironments.data)) {
                    setRunningNodeEnvironments(currentRunningNodeEnvironments.data);
                }
            }
        };

        possibleFeaturesRequest().catch(error => {
            // tslint:disable-next-line no-console
            console.error(error);
        });
    }, []);

    const data: Array<{ featureName: string; configName: string; url: string; runningNodeEnvironment: boolean }> = [];

    for (const featureName of featuresConfigsList.features) {
        for (const configName of featuresConfigsList.configs) {
            data.push({
                configName,
                featureName,
                url: `${location.href}main.html?feature=${featureName}&config=${configName}`,
                runningNodeEnvironment: runningNodeEnvironments[featureName]
                    ? runningNodeEnvironments[featureName].includes(configName)
                    : false
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
                <ServerEnvironmentButton
                    isServerActive={props.value.runningNodeEnvironment}
                    configName={props.value.configName}
                    featureName={props.value.featureName}
                    onClick={onServerEnvironmentStatusChange}
                />
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
