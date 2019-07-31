import React from 'react';
import { renderToString } from 'react-dom/server';
import { FeaturesTable, IFeatureTableProps } from './features-table';
 

export const getMainPage = (props: IFeatureTableProps) => {
    const reactString = renderToString(<FeaturesTable {...props} />);
    return `
    <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Engine Dashboard</title>
</head>
<body>
<h1>Engine Dashboard</h1>
  ${reactString}
</body>
</html>
    `;
};