import sampleFeature, { MAIN } from './y.feature.js';

sampleFeature.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.textContent = 'Custom Feature is running';
    });
});
