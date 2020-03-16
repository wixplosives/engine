import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { startEnvironment } }) => {
    run(async () => {
        await startEnvironment(serverEnv);
        document.body.textContent = await echoService.echo();
    });
    return null;
});
