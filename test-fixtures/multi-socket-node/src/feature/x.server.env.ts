import { serverEnv, anotherServerEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketClientInitializer } from '@wixc3/engine-core';

sampleFeature.setup(serverEnv, ({ anotherEchoService, run }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: anotherServerEnv });
    });
    return {
        echoService: {
            echo: () => {
                // working:
                // return anotherEchoService.echo();

                // not working:
                return anotherEchoService.echo(undefined);
            },
            getName: () => 'gaga',
        },
    };
});
