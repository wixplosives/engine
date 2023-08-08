import echoFeature, { serverEnv } from './echo.feature.js';

echoFeature.setup(serverEnv, () => {
    return {
        echoService: {
            echo: (s = 'dude, it works!') => s,
        },
    };
});
