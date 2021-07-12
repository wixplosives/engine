import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { localNodeEnvironmentInitializer } from '@wixc3/engine-core-node';

sampleFeature.setup(serverEnv, ({ anotherEchoService }, { COM: { startEnvironment } }) => {
    startEnvironment(anotherServerEnv, localNodeEnvironmentInitializer);
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
