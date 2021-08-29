import { anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(anotherServerEnv, ({ echoService }) => {
    return {
        anotherEchoService: {
            echo: async () => 'hello ' + (await echoService.getName()),
        },
    };
});
