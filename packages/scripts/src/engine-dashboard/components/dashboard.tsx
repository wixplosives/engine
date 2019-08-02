import React from 'react';
import { FeaturesList } from './features-list';

export const Dashboard: React.FunctionComponent = () => {
    return (
        <div>
            <h1>Engine Dashboard</h1>
            <FeaturesList />
        </div>
    );
};
