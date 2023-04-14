import sampleFeature, { serverEnv } from './y.feature';

sampleFeature.setup(serverEnv, () => {
    return {
        echoService: {
            echo: (s = 'dude, it works!') => s,
        },
    };
});
