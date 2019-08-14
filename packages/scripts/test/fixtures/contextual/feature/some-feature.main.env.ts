import { contextualEnv, mainEnv } from './some-feature.feature';
import sampleFeature from './some-feature.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(contextualEnv);
        document.body.innerText = await serverService.echo();
    });
    return null;
});
