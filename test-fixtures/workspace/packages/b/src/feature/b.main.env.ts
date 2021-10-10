import { MAIN } from '@fixture/a-in-workspace/dist/feature/a.feature';
import featureB from './b.feature';

featureB.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.style.backgroundColor = 'rgb(0, 128, 0)';
    });
});
