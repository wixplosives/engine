import { socketClientInitializer, webWorkerInitializer, initializeContextualEnv } from '@wixc3/engine-core';
import { contextualEnv, mainEnv } from './some-feature.feature.js';
import sampleFeature from './some-feature.feature.js';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { communication } }) => {
    run(async () => {
        /**
         * This the engine we bundle from cjs dist so webpack uses importScripts.
         * Our default webworker initializer uses esm so we need to override it.
         */
        await initializeContextualEnv({
            communication,
            env: contextualEnv,
            envInitializers: {
                server: socketClientInitializer,
                webworker: (opt) => webWorkerInitializer({ ...opt, workerOptions: { type: 'classic' } }),
            },
        });

        document.body.innerText = await serverService.echo();
    });
});
