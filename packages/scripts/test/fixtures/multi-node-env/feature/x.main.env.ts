import { socketServerInitializer } from '@wixc3/engine-core';
import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { startEnvironment } }) => {
    const echoValue = document.createElement('div');

    echoValue.id = 'echoValue';

    document.body.append(echoValue);

    run(async () => {
        await startEnvironment(serverEnv, socketServerInitializer());
        echoValue.textContent = await echoService.echo();
    });
});
