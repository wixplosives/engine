import featureA, { MAIN } from './a.feature';

featureA.setup(MAIN, ({ run }) => {
    run(() => {
        document.body.innerHTML = `feature a is running`;
    });
});
