/** @type {import('@wixc3/engine-scripts').EngineConfig} */
module.exports = {
    require: ['@ts-tools/node/r'],
    externalFeatureDefinitions: [
        {
            name: 'application-external',
            packageName: '@fixture/application-external',
        },
    ],
    externalFeaturesPath: './node_modules',
};
