import React from 'react';
import { renderToString } from 'react-dom/server';
import { FeaturesTable, IFeatureTableProps } from './table';

const MyComponent: React.FunctionComponent<IFeatureTableProps> =props => {
    return <FeaturesTable {...props} />;
}; 

export const getMainPage = (props: IFeatureTableProps) => {
    const reactString = renderToString(<MyComponent {...props} />);
    return `
    <html>
    <head>
    <link rel="stylesheet" href=${require.resolve('react-table/react-table.css')}>
    </head>
    <body>
    <h1>My First Server Side Render</h1>
    <div id="reactele">${reactString}</div>
    </body>
    </html>
    `;
};