import { socketServerInitializer, workerInitializer, initializeContextualEnv } from '@wixc3/engine-core';
import { contextualEnv, mainEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(
            contextualEnv,
            initializeContextualEnv(contextualEnv, {
                server: socketServerInitializer(),
                worker: workerInitializer(),
            })
        );

        document.body.innerText = await serverService.echo();
    });
});
