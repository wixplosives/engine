import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature';
import { workerInitializer, socketClientInitializer, initializeContextualEnv } from '@wixc3/engine-core';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { communication } }) => {
    const initializer = initializeContextualEnv({
        communication,
        env: processingEnv,
        envInitializers: {
            node1: socketClientInitializer,
            worker1: workerInitializer,
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
