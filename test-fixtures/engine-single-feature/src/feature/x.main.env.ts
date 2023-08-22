import sampleFeature, { MAIN } from './x.feature.js';

sampleFeature.setup(MAIN, ({ run, config }) => {
    run(() => {
        document.body.textContent = 'App is running with config: ' + JSON.stringify(config);
    });
});
