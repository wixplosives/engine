import { contextualEnv, mainEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(contextualEnv);
        document.body.innerText = await serverService.echo();
    });
    return null;
});
