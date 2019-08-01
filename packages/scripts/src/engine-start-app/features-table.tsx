import { get } from 'http';
import { join } from 'path';
import React from 'react';

export interface IFeatureTableProps {
    runningFeaturesAndConfigs: {
        features: string[];
        configs: string[];
    };
    mainUrl: string;
}
interface ITableRow {
    featureName: string;
    configName: string;
}

interface TableRowParams {
    featureName: string;
    configName: string;
    serverUrl: string;
}

const startServerFeature = ({ featureName, configName, serverUrl }: TableRowParams) => {
    return new Promise((resolve, reject) => {
        const urlParams = new URLSearchParams();
        urlParams.set('featureName', featureName);
        urlParams.set('configName', configName);

        const request = get(`${serverUrl}/start-server-env?${urlParams.toString()}`, res => {
            let dataChunks = '';
            res.on('error', reject);
            res.on('data', chunk => dataChunks += chunk);
            res.once('end', () => resolve(dataChunks));
        });
        request.on('error', reject);
    });
};


const defaultStyling = {
    row: {
        border: '1px solid black',
        display: 'flex',
        justifyContent: 'space-between',
        paddingBottom: '5px',
        fontSize: '16px',
        paddingLeft: '1vw',
        paddingRight: '1vw',
        textAlign: 'center' as const
    },
    column: {
        width: '25%'
    },
    container: {
        display: 'flex',
        flexDirection: 'column' as const
    }


};

const TableRow: React.FunctionComponent<TableRowParams> = ({featureName, configName, serverUrl}) => {
    return <div style={defaultStyling.row} key={join(featureName, configName)}> 
            <span style={defaultStyling.column}>{featureName}</span>
            <span style={defaultStyling.column}>{configName}</span>
            <div style={defaultStyling.column}><button onClick={() => { startServerFeature({ featureName, configName, serverUrl }                    ); }}>start remote server</button></div>
            <a style={defaultStyling.column} href={`${serverUrl}/main.html?feature=${featureName}&config=${configName}`}>go to page</a>
        </div>;
};

export const FeaturesTable: React.FunctionComponent<IFeatureTableProps> = ({
    runningFeaturesAndConfigs,
    mainUrl
}) => {
    const data: ITableRow[] = [];

    for (const featureName of runningFeaturesAndConfigs.features) {
        for (const configName of runningFeaturesAndConfigs.configs) {
            data.push({
                featureName,
                configName,
            });
        }
    }

    const rows = data.map(tableRow => <TableRow key={`${tableRow.featureName}/${tableRow.configName}`} serverUrl={mainUrl} {...tableRow} />);

    return (
        <div style={defaultStyling.container}>
            {rows}
        </div>
    );
};
