import sampleFeature, { MAIN } from './x.feature';

sampleFeature.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.textContent = 'App is running.';
    });
    return null;
});
