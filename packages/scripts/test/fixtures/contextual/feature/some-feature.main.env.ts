import { contextualEnv, mainEnv, serverEnv, workerEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';
import { socketServerInitializer, workerInitializer, initializeContextualEnv } from '@wixc3/engine-core/src';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { startEnvironment } }) => {
    const { initializer, setEnvironmentInitializer } = initializeContextualEnv(contextualEnv);

    setEnvironmentInitializer(serverEnv, socketServerInitializer());

    setEnvironmentInitializer(workerEnv, workerInitializer());

    run(async () => {
        await startEnvironment(contextualEnv, initializer);

        document.body.innerText = await serverService.echo();
    });
    return null;
});
