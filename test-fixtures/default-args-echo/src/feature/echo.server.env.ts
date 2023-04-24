import echoFeature, { serverEnv } from './echo.feature';

echoFeature.setup(serverEnv, () => {
    return {
        echoService: {
            echo: (s = 'dude, it works!') => s,
        },
    };
});
