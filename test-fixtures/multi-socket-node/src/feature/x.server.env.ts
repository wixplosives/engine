import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketClientInitializer } from '@wixc3/engine-core';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run, onDispose }, { COM: { communication } }) => {
    run(async () => {
        const { dispose } = await socketClientInitializer({ communication, env: anotherServerEnv });
        onDispose(dispose);
    });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
