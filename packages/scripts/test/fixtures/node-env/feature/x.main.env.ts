import { mainEnv, serverEnv } from './x.feature';
import sampleFeature from './x.feature';

sampleFeature.setup(mainEnv, ({ run, serverService }, { COM: { connect } }) => {
    run(async () => {
        await connect(serverEnv);
        document.body.textContent = await serverService.echo();
    });
    return null;
});
