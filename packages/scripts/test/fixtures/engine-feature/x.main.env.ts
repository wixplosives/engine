import { MAIN } from '3rd-party/3rd-party.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.textContent = 'App is running.';
    });
    return null;
});
