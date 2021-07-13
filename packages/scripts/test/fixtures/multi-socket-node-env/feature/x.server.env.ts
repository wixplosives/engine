import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketServerInitializer } from '@wixc3/engine-core';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run }, { COM: { communication } }) => {
    run(async () => {
        await socketServerInitializer(communication, anotherServerEnv);
    });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
