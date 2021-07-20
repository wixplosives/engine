import { MAIN } from '../../a/feature/a.feature';
import featureB from './b.feature';

featureB.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.style.backgroundColor = 'rgb(0, 128, 0)';
    });
});
