const { Application } = require('@wixc3/engine-scripts');
const app = new Application({
    basePath: __dirname
})

app.run({
    externalFeatureDefinitions: [
        {
            featureName: 'node-env-external',
            packageName: '@fixture/node-env-external'
        }
    ]
})