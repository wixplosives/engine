import sampleFeature, { serverEnv } from './feature';

sampleFeature.setup(serverEnv, () => {
    return {
        echoService: {
            echo: (s = 'dude, it works!') => s,
        },
    };
});
