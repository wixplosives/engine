/** @type {import('@wixc3/engine-scripts').EngineConfig} */
module.exports = {
    require: ['@ts-tools/node/r'],
    externalFeatureDefinitions: [
        {
            featureName: 'application-external',
            packageName: '@fixture/application-external-feature',
        },
    ],
};
