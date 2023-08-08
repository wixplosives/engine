import { MAIN } from '@fixture/a-in-workspace/dist/feature/a.feature.js';
import featureB from './b.feature.js';

featureB.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.style.backgroundColor = 'rgb(0, 128, 0)';
    });
});
