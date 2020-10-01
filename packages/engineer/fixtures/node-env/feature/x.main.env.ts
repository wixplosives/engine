import { socketServerInitializer } from '@wixc3/engine-core';
import sampleFeature, { mainEnv, serverEnv } from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(serverEnv, socketServerInitializer());
        document.body.textContent = await echoService.echo();
    });
});
