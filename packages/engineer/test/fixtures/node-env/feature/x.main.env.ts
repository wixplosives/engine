import { socketClientInitializer } from '@wixc3/engine-core';
import sampleFeature, { mainEnv, serverEnv } from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { communication } }) => {
    run(async () => {
        await socketClientInitializer({ communication, env: serverEnv });
        document.body.textContent = await echoService.echo();
    });
});
