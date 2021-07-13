import MultiEnvFeature, { mainEnv, processingEnv } from './multi-env.feature';
import { workerInitializer, socketServerInitializer, initializeContextualEnv } from '@wixc3/engine-core';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { communication } }) => {
    const initializer = initializeContextualEnv(communication, processingEnv, {
        node1: socketServerInitializer,
        worker1: workerInitializer,
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
