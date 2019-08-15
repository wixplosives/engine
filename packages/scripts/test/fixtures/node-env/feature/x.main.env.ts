import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, echoService }, { COM: { connect } }) => {
    run(async () => {
        await connect(serverEnv);
        document.body.textContent = await echoService.echo();
    });
    return null;
});
