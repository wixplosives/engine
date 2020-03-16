import MultiEnvFeature, { mainEnv, processingEnv, workerEnv, nodeEnv } from './multi-env.feature';
import { workerInitializer, socketServerInitializer, contextualInitializer } from '@wixc3/engine-core';

MultiEnvFeature.setup(mainEnv, ({ echoService, run, config }, { COM: { startEnvironment, communication } }) => {
    const { initializer, getEnvironmentInitializerId } = contextualInitializer(processingEnv);
    communication.setInitializer(getEnvironmentInitializerId(workerEnv), workerInitializer());
    communication.setInitializer(getEnvironmentInitializerId(nodeEnv), socketServerInitializer());

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
