import { socketServerInitializer } from '@wixc3/engine-core';
import sampleFeature, { mainEnv, serverEnv } from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { communication } }) => {
    run(async () => {
        await socketServerInitializer()(communication, serverEnv);
        document.body.textContent = await echoService.echo();
    });
});
