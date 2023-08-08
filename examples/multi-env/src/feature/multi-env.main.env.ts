import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature.js';
import { webWorkerInitializer, socketClientInitializer, initializeContextualEnv } from '@wixc3/engine-core';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { communication } }) => {
    const initializer = initializeContextualEnv({
        communication,
        env: processingEnv,
        envInitializers: {
            node1: socketClientInitializer,
            webworker1: webWorkerInitializer,
        },
    });

    run(async () => {
        await initializer;
        const message = await echoService.echo('roman');
        document.body.innerHTML = JSON.stringify({
            message,
            config,
        });
    });
});
