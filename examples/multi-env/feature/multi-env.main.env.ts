import MultiEnvFeature, { mainEnv, processingEnv, workerEnv, nodeEnv } from './multi-env.feature';
import { workerInitializer, socketServerInitializer, initializeContextualEnv } from '@wixc3/engine-core';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { startEnvironment } }) => {
    const { initializer, setEnvironmentInitializer } = initializeContextualEnv(processingEnv);
    setEnvironmentInitializer(workerEnv, workerInitializer());
    setEnvironmentInitializer(nodeEnv, socketServerInitializer());

    run(async () => {
        await startEnvironment(processingEnv, initializer);
        const message = await echoService.echo('roman');
        document.body.innerHTML = JSON.stringify({
            message,
            config
        });
    });

    return null;
});
