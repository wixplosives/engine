import { contextualEnv, mainEnv } from './contextual-with-worker-default.feature';
import sampleFeature from './contextual-with-worker-default.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { spawnOrConnect } }) => {
    run(async () => {
        await spawnOrConnect(contextualEnv);
        document.body.innerText = await serverService.echo();
    });
    return null;
});
