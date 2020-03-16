import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';
import { socketServerInitializer } from '@wixc3/engine-core/src';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { startEnvironment, communication } }) => {
    communication.setInitializer(serverEnv.env, socketServerInitializer());

    run(async () => {
        await startEnvironment(serverEnv);
        document.body.textContent = await echoService.echo();
    });
    return null;
});
