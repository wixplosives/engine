import { socketClientInitializer, webWorkerInitializer, initializeContextualEnv } from '@wixc3/engine-core';
import { contextualEnv, mainEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { communication } }) => {
    run(async () => {
        await initializeContextualEnv({
            communication,
            env: contextualEnv,
            envInitializers: { server: socketClientInitializer, webworker: webWorkerInitializer },
        });

        document.body.innerText = await serverService.echo();
    });
});
