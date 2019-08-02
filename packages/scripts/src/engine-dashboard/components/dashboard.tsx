import React from 'react';
import { FeaturesList } from './features-list';

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

export const Dashboard: React.FunctionComponent = () => {
    return (
        <div style={defaultStyling.container}>
            <h1>Engine Dashboard</h1>
            <FeaturesList />
        </div>
    );
};
