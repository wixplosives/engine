import helloWorldFeature, { myEnv } from './hello-world.feature';

helloWorldFeature.setup(myEnv, ({ run }) => {
    console.log('hello');

    run(() => {
        console.log('world');
    });
});
