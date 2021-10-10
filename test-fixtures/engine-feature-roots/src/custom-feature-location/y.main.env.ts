import sampleFeature, { MAIN } from './y.feature';

sampleFeature.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.textContent = 'Custom Feature is running';
    });
});
