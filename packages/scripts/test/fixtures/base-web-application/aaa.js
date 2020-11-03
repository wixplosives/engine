const { startDevServer } = require('@wixc3/engineer');
startDevServer({
    basePath: __dirname,
    singleFeature: true,
    featureName: 'base-web-application',
});
