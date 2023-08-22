import { localNodeEnvironmentInitializer } from '@wixc3/engine-runtime-node';
import sampleFeature, { anotherServerEnv, serverEnv } from './x.feature.js';

sampleFeature.setup(serverEnv, ({ anotherEchoService }, { COM: { communication } }) => {
    localNodeEnvironmentInitializer({ communication, env: anotherServerEnv });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
