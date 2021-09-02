import MyFeature, { page2 } from './variant.feature';

MyFeature.setup(page2, ({}, { envDependencies: { render } }) => {
    render('page 2 text');
});
