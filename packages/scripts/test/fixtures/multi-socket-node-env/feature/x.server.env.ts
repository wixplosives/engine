import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketServerInitializer } from '@wixc3/engine-core';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(anotherServerEnv, socketServerInitializer());
    });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
