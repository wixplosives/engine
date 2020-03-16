import { contextualEnv, mainEnv, serverEnv, workerEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';
import { socketServerInitializer, workerInitializer, contextualInitializer } from '@wixc3/engine-core/src';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { startEnvironment, communication } }) => {
    const { initializer, getEnvironmentInitializerId } = contextualInitializer(contextualEnv);

    communication.setInitializer(getEnvironmentInitializerId(serverEnv), socketServerInitializer());

    communication.setInitializer(getEnvironmentInitializerId(workerEnv), workerInitializer());

    run(async () => {
        await startEnvironment(contextualEnv, initializer);

        document.body.innerText = await serverService.echo();
    });
    return null;
});
