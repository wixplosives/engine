import MyFeature, { page2 } from './variant.feature.js';

MyFeature.setup(page2, ({}, { envDependencies: { render } }) => {
    render(page2.env);
});
