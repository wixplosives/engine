import sampleFeature, { anotherServerEnv } from './x.feature.js';

sampleFeature.setup(anotherServerEnv, ({ echoService }) => {
    return {
        anotherEchoService: {
            echo: async () => 'hello ' + (await echoService.getName()),
        },
    };
});
