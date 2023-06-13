import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { localNodeEnvironmentInitializer } from '@wixc3/engine-runtime-node';

sampleFeature.setup(serverEnv, ({ anotherEchoService }, { COM: { communication } }) => {
    localNodeEnvironmentInitializer({ communication, env: anotherServerEnv });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
