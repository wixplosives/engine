import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketClientInitializer } from '@wixc3/engine-com';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: anotherServerEnv });
    });
    return {
        echoService: {
            echo: () => anotherEchoService.echo(),
            getName: () => 'gaga',
        },
    };
});
