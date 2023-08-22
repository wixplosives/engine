import featureA, { MAIN } from './a.feature.js';

featureA.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.innerHTML = `feature a is running`;
    });
});
