import sampleFeature, { serverEnv } from './echo.feature';

sampleFeature.setup(serverEnv, () => {
    return {
        echoService: {
            echo: (s = 'dude, it works!') => s,
        },
    };
});
