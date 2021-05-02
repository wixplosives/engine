import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { localNodeEnvironmentInitializer } from '@wixc3/engine-core-node';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(anotherServerEnv, localNodeEnvironmentInitializer);
    });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
