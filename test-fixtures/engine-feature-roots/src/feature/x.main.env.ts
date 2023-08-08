import sampleFeature, { MAIN } from './x.feature.js';

sampleFeature.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.textContent = 'Root Feature is running';
    });
});
