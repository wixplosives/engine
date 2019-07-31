import 'react-table/react-table.css';

import { join } from 'path';
import React from 'react';
import { IFeatureTarget } from '../application';

export interface IFeatureTableProps {
    runningFeaturesAndConfigs: {
        features: string[];
        configs: string[];
        runFeature: (target: IFeatureTarget) => Promise<{
            close: () => Promise<void>;
        }>
    };
    mainUrl: string;
}
interface ITableRow {
    featureName: string;
    configName: string;
    url: JSX.Element;
}

export const FeaturesTable: React.FunctionComponent<IFeatureTableProps> = ({ runningFeaturesAndConfigs, mainUrl }) => {
    const data: ITableRow[] = [];
    for (const featureName of runningFeaturesAndConfigs.features) {
        for (const configName of runningFeaturesAndConfigs.configs) {
            data.push({
                featureName,
                configName,
                url: <a href={`${mainUrl}/main.html?feature=${featureName}&config=${configName}`}>go to page</a>
            });
        }
    }

    // const columns: Column[] = [{
    //     Header: 'Feature Name',
    //     accessor: 'feature-name'
    // }, {
    //     Header: 'Config Name',
    //     accessor: 'config-name'
    // }, {
    //     Header: 'Go to feature',
    //     accessor: 'go-to-feature',
    //     Cell: props => <a href={props.value}>{props.value}</a>
    // }];
    const rows = data.map(({configName, url, featureName}) => <tr key={join(featureName, configName)}>
        <td>{featureName}</td>
        <td>{configName}</td>
        <td>{url}</td>
    </tr>);
    

    return (
        <table>
            <thead>
                <tr>
                    <td>Feature Name</td>
                    <td>Config Name</td>
                    <td>Go to feature</td>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
    );
};
